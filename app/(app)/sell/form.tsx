'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { publishListing } from './actions';
import { CATEGORIES, CONDITIONS, CONDITION_NOTE, blockedReason, type Hostel, type Mode } from '@/lib/types';
import { Image as ImageIcon } from '@/components/icons';

const MODES: { key: Mode; title: string; note: string }[] = [
  { key: 'sell', title: 'Sell it', note: 'One price, one new owner' },
  { key: 'rent', title: 'Rent it out', note: 'Lend it for a few days at a time' },
  { key: 'both', title: 'Either', note: 'Let them buy it or borrow it' },
  { key: 'free', title: 'Give it away', note: 'Costs nothing, saves a trip to the bin' },
];

const EXTRA_FIELDS: Record<string, string[]> = {
  'Books & Study Materials': ['Author', 'Edition'],
  'Cycles & Accessories': ['Brand', 'Brakes, tyres and chain'],
  'Electronics & Tech': ['Brand and model', 'Faults or warranty'],
  'Clothing & Formals': ['Size and measurements', 'Last cleaned'],
  Appliances: ['Brand and wattage', 'Permitted in hostel?'],
  'Academic & Project Kits': ['What is included', 'Tested?'],
  'Events & Tickets': ['Event and date', 'Face value'],
};
const DEFAULT_FIELDS = ['Age', 'Known faults'];

/** Resize in the browser: hostel wifi should not have to carry a 6MB photo. */
function shrink(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Use a JPG, PNG or WebP image.'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('That image could not be read.'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. Try another.'));
    };
    img.src = url;
  });
}

export default function SellForm({ hostels, defaultHostel }: { hostels: Hostel[]; defaultHostel: string | null }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('Good');
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('sell');
  const [price, setPrice] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState('day');
  const [deposit, setDeposit] = useState('');
  const [hostel, setHostel] = useState(defaultHostel ?? '');
  const [pickup, setPickup] = useState('');

  const fields = EXTRA_FIELDS[category] ?? DEFAULT_FIELDS;
  const sells = mode === 'sell' || mode === 'both';
  const rents = mode === 'rent' || mode === 'both';

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 4) {
      setError('Four photos is plenty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Your session expired. Sign in again.');

      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const blob = await shrink(file, 1400, 0.72);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw new Error('That photo would not upload. Try a smaller one.');
        urls.push(supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That photo would not upload.');
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setError(null);
    if (step === 1) {
      if (!images.length) return setError('Add at least one photo.');
      if (title.trim().length < 3) return setError('Give the item a title.');
      if (!category) return setError('Choose a category.');
      const blocked = blockedReason(title);
      if (blocked) return setError(blocked);
    }
    if (step === 2 && description.trim().length < 20) {
      return setError('Write a line or two about it — condition, age, anything that bites.');
    }
    if (step === 3) {
      if (sells && !(Number(price) > 0)) return setError('Set a selling price.');
      if (rents && !(Number(rate) > 0)) return setError('Set a rental rate.');
    }
    setStep((s) => Math.min(4, s + 1));
  }

  function publish() {
    setError(null);
    if (!pickup.trim()) return setError('Say when someone can collect it.');
    start(async () => {
      const result = await publishListing({
        title,
        category,
        description,
        condition,
        mode,
        price: Number(price) || 0,
        rate: Number(rate) || 0,
        unit,
        deposit: Number(deposit) || 0,
        hostel_id: hostel || null,
        pickup,
        attributes: extras,
        image_urls: images,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="form">
      <div className="steps" aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((i) => (
          <i key={i} data-on={i <= step} />
        ))}
      </div>

      {step === 1 && (
        <div className="stack">
          <div className="drop">
            <ImageIcon size={26} />
            <div style={{ margin: '8px 0 4px', fontWeight: 600 }}>Photos of the actual item</div>
            <p className="small muted" style={{ marginBottom: 12 }}>
              Up to four. Resized on your phone before they upload.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = '';
              }}
            />
            {busy && <p className="small muted" style={{ marginTop: 10 }}>Uploading…</p>}
            {images.length > 0 && (
              <div className="shots">
                {images.map((src) => (
                  <figure key={src}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((u) => u !== src))}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <label className="field">
            <span>What is it</span>
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hercules cycle, serviced last month"
            />
          </label>

          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose one</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="note">
            Laptops and phones are out of scope for this pilot, and so is anything every room already
            has — tables, chairs, cupboards.
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <label className="field">
            <span>Condition</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="small muted" style={{ fontWeight: 400, marginTop: 5 }}>
              {CONDITION_NOTE[condition]}
            </span>
          </label>

          <label className="field">
            <span>
              Description <em>— what would you want to be told?</em>
            </span>
            <textarea
              value={description}
              maxLength={1500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Two years old, works perfectly, small dent on the base from a fall."
            />
          </label>

          {fields.map((f) => (
            <label className="field" key={f}>
              <span>{f}</span>
              <input
                value={extras[f] ?? ''}
                maxLength={150}
                onChange={(e) => setExtras((prev) => ({ ...prev, [f]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <div className="picker">
            {MODES.map((m) => (
              <button key={m.key} type="button" data-on={mode === m.key} onClick={() => setMode(m.key)}>
                <b>{m.title}</b>
                <small>{m.note}</small>
              </button>
            ))}
          </div>

          {sells && (
            <label className="field">
              <span>Selling price, rupees</span>
              <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
          )}

          {rents && (
            <>
              <div className="row2">
                <label className="field">
                  <span>Rental rate, rupees</span>
                  <input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} />
                </label>
                <label className="field">
                  <span>Per</span>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                    <option value="semester">semester</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>
                  Deposit <em>— refundable, you hold it yourself</em>
                </span>
                <input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </label>
              <div className="note">
                A month counts as 30 days and a semester as 120. Part of a period rounds up.
              </div>
            </>
          )}

          {mode === 'free' && <div className="note">It will be listed at ₹0.</div>}
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <label className="field">
            <span>Which hostel is it in</span>
            <select value={hostel} onChange={(e) => setHostel(e.target.value)}>
              <option value="">Not in a hostel</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <span className="small muted" style={{ fontWeight: 400, marginTop: 5 }}>
              This is what puts your item at the top of a neighbour&rsquo;s list.
            </span>
          </label>

          <label className="field">
            <span>When can someone collect it</span>
            <input
              value={pickup}
              maxLength={100}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Weekday evenings after 7"
            />
          </label>

          <div className="panel">
            <h3>{title || 'Your listing'}</h3>
            <p className="small muted" style={{ marginBottom: 8 }}>
              {category || 'Uncategorised'} · {condition}
            </p>
            <p className="tnum" style={{ fontWeight: 650 }}>
              {mode === 'free'
                ? 'Free'
                : rents && !sells
                  ? `₹${rate || 0} per ${unit}`
                  : `₹${price || 0}${rents ? ` · ₹${rate || 0} per ${unit} to rent` : ''}`}
            </p>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          type="button"
          className="btn"
          onClick={() => (step === 1 ? history.back() : setStep((s) => s - 1))}
          disabled={pending}
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {step < 4 ? (
          <button type="button" className="btn primary" onClick={next} disabled={busy || pending}>
            Continue
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={publish} disabled={pending}>
            {pending ? 'Publishing…' : 'Publish listing'}
          </button>
        )}
      </div>
    </div>
  );
}
