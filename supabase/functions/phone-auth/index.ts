import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const explicitTestMode = Deno.env.get("OTP_TEST_MODE");
const smsProvider = Deno.env.get("SMS_PROVIDER") ?? "twilio";
const smsAccountSid = Deno.env.get("SMS_ACCOUNT_SID");
const smsAuthToken = Deno.env.get("SMS_AUTH_TOKEN");
const smsFromNumber = Deno.env.get("SMS_FROM_NUMBER");
const smsConfigured = !!(smsAccountSid && smsAuthToken && smsFromNumber);
const testMode = explicitTestMode === "true" || (explicitTestMode !== "false" && !smsConfigured);

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function generateSecureOtp(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += String(bytes[i] % 10);
  }
  return code;
}

async function hashOtp(otp: string): Promise<string> {
  const encoded = new TextEncoder().encode(otp);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("919") && /^[6-9]/.test(digits.slice(3))) return `+${digits}`;
  return null;
}

async function sendOtpSms(phoneNumber: string, otp: string): Promise<void> {
  if (testMode) {
    console.log(`\n========================================`);
    console.log(`[TEST MODE] OTP for ${phoneNumber}: ${otp}`);
    console.log(`========================================\n`);
    return;
  }
  if (!smsConfigured) {
    throw new Error("SMS provider not configured. Set OTP_TEST_MODE=true or provide SMS credentials.");
  }
  const message = `Your Khan Creations verification code is ${otp}. It expires in 5 minutes.`;
  if (smsProvider === "twilio") {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${smsAccountSid}/Messages.json`;
    const auth = btoa(`${smsAccountSid}:${smsAuthToken}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: smsFromNumber, To: phoneNumber, Body: message }),
    });
    if (!res.ok) throw new Error("Failed to send SMS.");
  } else {
    throw new Error(`Unsupported SMS provider: ${smsProvider}`);
  }
}

async function checkRateLimit(phone: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("phone_otp_verifications")
    .select("id", { count: "exact", head: true })
    .or(`phone_number.eq.${phone}`)
    .gt("created_at", since);
  return (count ?? 0) >= RATE_LIMIT_MAX_REQUESTS;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "send") {
      const { name, phone } = body as { name: string; phone: string };
      if (!name || !phone) return json({ error: "Name and phone number are required." }, 400);

      const normalized = normalizeIndianPhone(phone);
      if (!normalized) return json({ error: "Please enter a valid Indian mobile number." }, 400);

      const ip = getClientIp(req);
      if (await checkRateLimit(normalized, ip)) {
        return json({ error: "Too many requests. Please try again later." }, 429);
      }

      const { data: recent } = await supabase
        .from("phone_otp_verifications")
        .select("last_sent_at")
        .eq("phone_number", normalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent) {
        const elapsed = Date.now() - new Date(recent.last_sent_at).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return json({ error: `Please wait ${waitSec}s before requesting a new OTP.`, cooldown_seconds: waitSec }, 429);
        }
      }

      const otp = generateSecureOtp();
      const otpHash = await hashOtp(otp);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      const { error: insertError } = await supabase.from("phone_otp_verifications").insert({
        phone_number: normalized,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        max_attempts: MAX_ATTEMPTS,
        verified: false,
        last_sent_at: now.toISOString(),
      });

      if (insertError) throw insertError;

      try {
        await sendOtpSms(normalized, otp);
      } catch {
        return json({ error: "Unable to send OTP. Please try again." }, 500);
      }

      return json({ message: "OTP sent successfully.", expires_in: 300 });
    }

    if (action === "verify") {
      const { phone, code, name } = body as { phone: string; code: string; name: string };
      if (!phone || !code) return json({ error: "Phone number and OTP are required." }, 400);

      const normalized = normalizeIndianPhone(phone);
      if (!normalized) return json({ error: "Please enter a valid Indian mobile number." }, 400);

      const { data: record, error: queryError } = await supabase
        .from("phone_otp_verifications")
        .select("id, otp_hash, expires_at, attempts, max_attempts, verified")
        .eq("phone_number", normalized)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) throw queryError;
      if (!record) return json({ error: "OTP has expired. Please request a new OTP." }, 400);

      if (new Date(record.expires_at).getTime() < Date.now()) {
        return json({ error: "OTP has expired. Please request a new OTP." }, 400);
      }

      if (record.attempts >= record.max_attempts) {
        return json({ error: "Maximum attempts exceeded. Please request a new OTP." }, 400);
      }

      const submittedHash = await hashOtp(code);
      if (submittedHash !== record.otp_hash) {
        const newAttempts = record.attempts + 1;
        await supabase
          .from("phone_otp_verifications")
          .update({ attempts: newAttempts })
          .eq("id", record.id);

        const remaining = record.max_attempts - newAttempts;
        if (remaining <= 0) {
          return json({ error: "Maximum attempts exceeded. Please request a new OTP." }, 400);
        }
        return json({ error: `Incorrect OTP. You have ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` }, 400);
      }

      await supabase
        .from("phone_otp_verifications")
        .update({ verified: true, attempts: record.attempts + 1 })
        .eq("id", record.id);

      const phoneDigits = normalized.replace(/\D/g, "");
      const email = `${phoneDigits}@phone.khancreations.app`;
      const fullName = name || "Customer";

      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: normalized },
      });

      if (createError && !createError.message.toLowerCase().includes("already")) {
        throw createError;
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin
        .generateLink({ type: "magiclink", email });

      if (linkError) throw linkError;

      await supabase.from("profiles").upsert({
        id: linkData.user.id,
        email,
        full_name: fullName,
        phone: normalized,
        role: "customer",
      });

      return json({ token_hash: linkData.properties.hashed_token, message: "Phone number verified successfully." });
    }

    return json({ error: "Unknown action. Use 'send' or 'verify'." }, 400);
  } catch (err) {
    return json({ error: "Unable to process request. Please try again." }, 500);
  }
});
