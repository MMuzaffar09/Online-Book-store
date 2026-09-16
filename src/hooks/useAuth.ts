import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'admin';
};

function getEdgeFunctionUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
  const clientUrl = supabase ? (supabase as unknown as { supabaseUrl?: string }).supabaseUrl || '' : '';
  return `${envUrl || clientUrl}/functions/v1/phone-auth`;
}

function showDevelopmentOtp(otp: string) {
  const existing = document.getElementById('development-otp-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'development-otp-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = [
    'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)', 'z-index:99999',
    'background:#fff', 'border:2px solid #d9b477', 'border-radius:12px', 'padding:16px 22px',
    'box-shadow:0 10px 30px rgba(0,0,0,.18)', 'font-family:Arial,sans-serif', 'text-align:center',
    'min-width:280px', 'color:#183b37'
  ].join(';');
  banner.innerHTML = `<div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Development OTP</div><div style="font-size:28px;font-weight:800;letter-spacing:5px">${otp}</div><div style="font-size:12px;margin-top:7px;color:#777">Testing only — SMS is not configured.</div>`;
  document.body.appendChild(banner);
  window.setTimeout(() => banner.remove(), 30000);
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (user: User) => {
    if (!supabase) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
      return;
    }
    setProfile(data as AuthProfile);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        void fetchProfile(data.session.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        void fetchProfile(newSession.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Database connection is not available. Add the Supabase environment variables in your deployment settings.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const sendPhoneOtp = useCallback(async (name: string, phone: string): Promise<{ expiresIn: number }> => {
    if (!supabase) throw new Error('Database connection is not available. Add the Supabase environment variables in your deployment settings.');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    const functionUrl = getEdgeFunctionUrl();
    if (!functionUrl || !anonKey) throw new Error('Supabase configuration is incomplete.');
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ action: 'send', name, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Unable to send OTP. Please try again.');
    if (data.test_otp) showDevelopmentOtp(String(data.test_otp));
    return { expiresIn: data.expires_in ?? 300 };
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, code: string, name: string): Promise<void> => {
    if (!supabase) throw new Error('Database connection is not available. Add the Supabase environment variables in your deployment settings.');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    const functionUrl = getEdgeFunctionUrl();
    if (!functionUrl || !anonKey) throw new Error('Supabase configuration is incomplete.');
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ action: 'verify', phone, code, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Verification failed.');

    if (data.token_hash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'email',
      });
      if (error) throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return { session, profile, loading, signIn, signOut, sendPhoneOtp, verifyPhoneOtp };
}
