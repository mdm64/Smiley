'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, type Hostel } from '@/lib/types';
import { useState } from 'react';

const MODES = [
  { key: '', label: 'Everything' },
  { key: 'buy', label: 'To buy' },
  { key: 'rent', label: 'To rent' },
  { key: 'free', label: 'Free' },
];

export default function Filters({ hostels }: { hostels: Hostel[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/browse?${next.toString()}`);
  };

  const mode = params.get('mode') ?? '';
  const extras = ['category', 'max', 'hostel', 'sort'].filter((k) => params.get(k));

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 3 }}>
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => set('mode', m.key)}
              aria-pressed={mode === m.key}
              style={{
                padding: '5px 11px',
                borderRadius: 4,
                fontSize: 'var(--step--1)',
                fontWeight: mode === m.key ? 600 : 500,
                background: mode === m.key ? 'var(--brick-soft)' : 'transparent',
                color: mode === m.key ? 'var(--brick-ink)' : 'var(--ink-2)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Filters{extras.length ? ` (${extras.length})` : ''}
        </button>

        {extras.length > 0 && (
          <button className="btn quiet" onClick={() => router.push('/browse')}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="row2">
            <label className="field">
              <span>Category</span>
              <select value={params.get('category') ?? ''} onChange={(e) => set('category', e.target.value)}>
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Hostel</span>
              <select value={params.get('hostel') ?? ''} onChange={(e) => set('hostel', e.target.value)}>
                <option value="">Anywhere on campus</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row2">
            <label className="field">
              <span>
                Up to <em>rupees</em>
              </span>
              <input
                type="number"
                min={0}
                defaultValue={params.get('max') ?? ''}
                onBlur={(e) => set('max', e.target.value)}
                placeholder="No limit"
              />
            </label>
            <label className="field">
              <span>Order</span>
              <select value={params.get('sort') ?? 'recent'} onChange={(e) => set('sort', e.target.value)}>
                <option value="recent">Newest first</option>
                <option value="low">Cheapest first</option>
                <option value="high">Dearest first</option>
              </select>
            </label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Listings stay grouped by walking distance whatever you filter by.
          </p>
        </div>
      )}
    </div>
  );
}
