'use server';

import { createClient } from '@/lib/supabase/server';
import { emailProblem, isInstituteEmail } from '@/lib/domain';

export type AuthState = {
  stage: 'email' | 'code';
  email: string;
  error: string | null;
  notice: string | null;
};

/** Step one: send a six-digit code to an institute address. */
export async function sendCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  // Checked again here because the browser check is a convenience, not a control.
  const problem = emailProblem(email);
  if (problem) return { stage: 'email', email, error: problem, notice: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    const message = /rate|limit|seconds/i.test(error.message)
      ? 'Too many codes requested. Wait a minute and try again.'
      : /only|allowed|iitd/i.test(error.message)
        ? 'ReLoop is open to IIT Delhi email addresses only.'
        : 'That code could not be sent. Check the address and try again.';
    return { stage: 'email', email, error: message, notice: null };
  }

  return { stage: 'code', email, error: null, notice: `Code sent to ${email}.` };
}

/** Step two: exchange the code for a session. */
export async function verifyCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('token') ?? '').replace(/\D/g, '');

  if (!isInstituteEmail(email)) {
    return { stage: 'email', email: '', error: 'Start again with your institute address.', notice: null };
  }
  if (token.length !== 6) {
    return { stage: 'code', email, error: 'Enter the six digits from the email.', notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

  if (error) {
    const message = /expired/i.test(error.message)
      ? 'That code has expired. Send a new one.'
      : 'That code is not right. Check the email and retype it.';
    return { stage: 'code', email, error: message, notice: null };
  }

  return { stage: 'code', email, error: null, notice: 'ok' };
}
