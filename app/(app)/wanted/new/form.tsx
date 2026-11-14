'use client';

import { useState, useTransition } from 'react';
import { postWanted } from '../actions';
import { CATEGORIES, blockedReason, type Hostel } from '@/lib/types';

export default function WantedForm({ hostels, defaultHostel }: { hostels: Hostel[]; defaultHostel: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [hostel, setHostel] = useState(defaultHostel ?? '');

  const submit = () => {
    setError(null);
    if (title.trim().length < 3) return setError('Say what you are looking for.');
    const blocked = blockedReason(`${title} ${description}`);
    if (blocked) return setError(blocked);
    start(async () => {
      const res = await postWanted({
        title,
        description,
        category,
        max_budget: Number(budget) > 0 ? Number(budget) : null,
        needed_by: neededBy || null,
        hostel_id: hostel || null,
      });
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="form stack">
      <label className="field">
        <span>What do you need</span>
        <input
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Room heater for the winter"
        />
      </label>

      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          Details <em>— optional</em>
        </span>
        <textarea
          value={description}
          maxLength={600}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Rent is fine. Needed from December, 1000W or less."
        />
      </label>

      <div className="row2">
        <label className="field">
          <span>
            Budget, rupees <em>— optional</em>
          </span>
          <input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <label className="field">
          <span>
            Needed by <em>— optional</em>
          </span>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Your hostel</span>
        <select value={hostel} onChange={(e) => setHostel(e.target.value)}>
          <option value="">Not in a hostel</option>
          {hostels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <span className="small muted" style={{ fontWeight: 400, marginTop: 5 }}>
          Shown so sellers know how far they would walk. Your room number is never asked for.
        </span>
      </label>

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn" onClick={() => history.back()} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={submit} disabled={pending}>
          {pending ? 'Posting…' : 'Post request'}
        </button>
      </div>
    </div>
  );
}
