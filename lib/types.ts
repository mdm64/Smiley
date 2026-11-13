export type Mode = 'sell' | 'rent' | 'both' | 'free';
export type Status = 'active' | 'paused' | 'sold' | 'given' | 'removed';

export type Hostel = { id: string; name: string; zone: string; sort_order: number };

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  hostel_id: string | null;
  room_no: string | null;
  phone: string | null;
};

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  description: string;
  condition: string;
  mode: Mode;
  price: number;
  rate: number;
  unit: 'day' | 'week' | 'month' | 'semester';
  deposit: number;
  hostel_id: string | null;
  pickup: string;
  attributes: Record<string, string>;
  image_urls: string[];
  status: Status;
  created_at: string;
};

export type ListingWithSeller = Listing & {
  seller: Pick<Profile, 'id' | 'display_name' | 'hostel_id'> | null;
};

export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  offer_amount: number | null;
  created_at: string;
};

export const CATEGORIES = [
  'Books & Study Materials',
  'Cycles & Accessories',
  'Electronics & Tech',
  'Hostel Essentials',
  'Appliances',
  'Clothing & Formals',
  'Sports & Fitness',
  'Academic & Project Kits',
  'Events & Tickets',
  'Free / Pass It On',
  'Other',
] as const;

export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Worn'] as const;

export const CONDITION_NOTE: Record<string, string> = {
  New: 'Unused, sealed or with tags on',
  'Like New': 'Used a handful of times, no visible wear',
  Good: 'Works fully, light cosmetic wear',
  Fair: 'Works, visible wear or a small fault described below',
  Worn: 'Heavy wear or a known fault, priced to match',
};

/** Items every hostel room already has, or that are too risky to trade here. */
export const BLOCKED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(study )?table\b|\bchair\b/i, reason: 'Every hostel room already has a table and chair.' },
  { pattern: /\bcupboard\b|\balmirah\b|\bwardrobe\b/i, reason: 'Rooms come with built-in storage.' },
  { pattern: /\bfridge\b|\brefrigerator\b/i, reason: 'Fridges are not permitted in most hostel rooms.' },
  { pattern: /\blaptop\b|\bmacbook\b|\biphone\b|\bsmartphone\b/i, reason: 'Laptops and phones are outside this pilot — the fraud risk is too high.' },
];

export function blockedReason(text: string): string | null {
  for (const { pattern, reason } of BLOCKED) if (pattern.test(text)) return reason;
  return null;
}
