/*
# Create OTP codes table for custom phone authentication

1. New Tables
- `otp_codes`: stores temporary verification codes for phone-based sign-in.
  - `phone` (text, not null) — the phone number being verified.
  - `full_name` (text) — the customer's display name, captured at send time.
  - `code` (text, not null) — the 6-digit verification code.
  - `verified` (boolean, default false) — whether the code has been used.
  - `expires_at` (timestamptz, not null) — code expiry, 10 minutes from creation.
  - `created_at` (timestamptz, default now).

2. Security
- Row Level Security is enabled on `otp_codes`.
- NO policies are added — the table is only accessible via the service role key
  (used by the phone-auth edge function). The anon and authenticated roles cannot
  read or write OTP codes directly, which prevents code enumeration or tampering.

3. Important Notes
- This table supports a custom OTP flow that does not require an external SMS provider.
- The edge function generates codes, stores them here, and verifies them before
  creating a Supabase auth user and returning a magic-link token hash.
- Old unverified codes are not automatically deleted but are effectively ignored
  because verification checks `verified = false` and `expires_at > now()`.
*/

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON public.otp_codes(phone);
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx ON public.otp_codes(expires_at);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
