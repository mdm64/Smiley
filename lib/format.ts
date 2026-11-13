import type { Listing, Hostel } from './types';

export const rupees = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function priceLabel(l: Pick<Listing, 'mode' | 'price' | 'rate' | 'unit'>) {
  if (l.mode === 'free') return { value: 'Free', suffix: '', rent: false };
  if (l.mode === 'rent') return { value: rupees(l.rate), suffix: `/ ${l.unit}`, rent: true };
  return { value: rupees(l.price), suffix: '', rent: false };
}

export function modeChip(mode: Listing['mode']) {
  if (mode === 'rent') return { text: 'For rent', cls: 'rent' };
  if (mode === 'both') return { text: 'Buy or rent', cls: 'sale' };
  if (mode === 'free') return { text: 'Pass it on', cls: 'free' };
  return { text: 'For sale', cls: 'sale' };
}

/** How far this listing is from the viewer, which is how browse is organised. */
export type Band = 'here' | 'near' | 'campus';

export function distanceBand(
  listingHostel: string | null,
  myHostel: string | null,
  hostels: Hostel[],
): Band {
  if (!listingHostel || !myHostel) return 'campus';
  if (listingHostel === myHostel) return 'here';
  const a = hostels.find((h) => h.id === listingHostel);
  const b = hostels.find((h) => h.id === myHostel);
  return a && b && a.zone === b.zone ? 'near' : 'campus';
}

export const BAND_COPY: Record<Band, { title: (hostel?: string) => string; hint: string }> = {
  here: {
    title: (hostel) => (hostel ? `In ${hostel}` : 'In your hostel'),
    hint: 'Down the corridor',
  },
  near: { title: () => 'A short walk', hint: 'Neighbouring hostels' },
  campus: { title: () => 'Across campus', hint: 'Worth the cycle ride' },
};

export function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
