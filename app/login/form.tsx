'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sendCode, verifyCode, type AuthState } from './actions';
import { ALLOWED_DOMAIN, emailProblem } from '@/lib/domain';
import { Shield, Back } from '@/components/icons';

const EMPTY: AuthState = { stage: 'email', email: '', error: null, notice: null };

export default function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') || '/browse';

  const [sent, sendAction, sending] = useActionState(sendCode, EMPTY);
  const [checked, verifyAction, verifying] = useActionState(verifyCode, EMPTY);

  const stage = checked.stage === 'code' && checked.notice === 'ok' ? 'done' : sent.stage;
  const email = sent.email;

  const [typed, setTyped] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // A verified code means the session cookie is set; a full navigation picks it up.
  useEffect(() => {
    if (checked.notice === 'ok') window.location.assign(next);
  }, [checked.notice, next]);

  useEffect(() => {
    if (sent.stage === 'code') codeRef.current?.focus();
  }, [sent.stage]);

  if (stage === 'done') {
    return <p className="muted">Signing you in…</p>;
  }

  if (sent.stage === 'code') {
    return (
      <div className="auth-form">
        <h2>Check your inbox</h2>
        <p className="muted" style={{ margin: '6px 0 20px' }}>
          We sent a six-digit code to <strong>{email}</strong>. It is good for one hour.
        </p>

        <form action={verifyAction}>
          <input type="hidden" name="email" value={email} />
          <label className="field">
            <span>Six-digit code</span>
            <input
              ref={codeRef}
              className="input code"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              aria-label="Six-digit code"
            />
          </label>
          {checked.error && <p className="error">{checked.error}</p>}
          <button className="btn primary wide" style={{ marginTop: 6 }} disabled={verifying}>
            {verifying ? 'Checking…' : 'Sign in'}
          </button>
        </form>

        <form action={sendAction} style={{ marginTop: 14 }}>
          <input type="hidden" name="email" value={email} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn quiet" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send another code'}
            </button>
            <a className="btn quiet" href="/login">
              <Back size={15} /> Use a different address
            </a>
          </div>
        </form>

        <p className="small muted" style={{ marginTop: 18 }}>
          Nothing arrived? It can take a minute, and it sometimes lands in spam.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Sign in</h2>
      <p className="muted" style={{ margin: '6px 0 20px' }}>
        No password. We email you a six-digit code.
      </p>

      <form
        action={sendAction}
        onSubmit={(e) => {
          const problem = emailProblem(typed);
          if (problem) {
            e.preventDefault();
            setLiveError(problem);
          }
        }}
      >
        <label className="field">
          <span>Institute email</span>
          <input
            className="input"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder={`yourname@${ALLOWED_DOMAIN}`}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              if (liveError) setLiveError(null);
            }}
          />
        </label>

        {(liveError || sent.error) && <p className="error">{liveError ?? sent.error}</p>}

        <button className="btn primary wide" style={{ marginTop: 6 }} disabled={sending}>
          {sending ? 'Sending code…' : 'Email me a code'}
        </button>
      </form>

      <div className="note" style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <Shield size={18} />
        <span>
          Only <strong>@{ALLOWED_DOMAIN}</strong> addresses, including departmental ones such as
          cse.{ALLOWED_DOMAIN}. The code proves you can read that inbox, which is what makes a
          seller on ReLoop a real classmate.
        </span>
      </div>
    </div>
  );
}
