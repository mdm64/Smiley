# ReLoop

The IIT Delhi campus marketplace. Buy, rent and pass on used things with students a few hostels
away. Real six-digit OTP sign-in restricted to `@iitd.ac.in`, a Postgres database that enforces who
may edit what, and live chat.

Runs on the free tiers of Supabase and Vercel. No Claude subscription, no paid plan, no credit card.

---

## Deploy it — about 30 minutes

You need a GitHub account, a [Supabase](https://supabase.com) account and a
[Vercel](https://vercel.com) account. All three are free to sign up for.

### 1. Put the code on GitHub

From the project folder:

```sh
git init
git add .
git commit -m "ReLoop"
```

Make a new empty repository on GitHub, then follow the two lines it shows you
(`git remote add origin …` and `git push -u origin main`).

### 2. Create the Supabase project

1. Go to supabase.com, **New project**. Pick any name.
2. Choose the region closest to Delhi — **South Asia (Mumbai)**.
3. Set a database password and keep it somewhere. You will not need it for this app, but you
   cannot see it again.
4. Wait about two minutes while it provisions.

### 3. Create the tables

1. In your project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the whole file, paste it in. Then do the same with `supabase/trust-and-deals.sql` (recorded deals, feedback, the wanted board, privacy and rental reminders).
3. Press **Run**.

You should see "Success. No rows returned." That one file creates every table, every security
policy, the photo bucket, the fifteen hostels, and the trigger that refuses any address which is
not an IIT Delhi one.

### 4. Turn the magic link into a six-digit code

**This is the step people miss.** By default Supabase emails a link, not a code, and the app asks
for a code.

1. Go to **Authentication** → **Emails** (on some versions: Templates).
2. Choose the **Magic Link** template.
3. Replace the whole body with:

```html
<h2>Your ReLoop code</h2>
<p>Enter this code to sign in. It expires in one hour.</p>
<p style="font-size:30px;letter-spacing:7px;font-weight:bold">{{ .Token }}</p>
<p style="color:#666;font-size:13px">If you did not ask for this, ignore this email.</p>
```

`{{ .Token }}` is what produces the six digits. Save.

### 5. Get your two keys

**Settings** → **API**. Copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use the **anon** key, never the `service_role` key. The service role key bypasses every security
policy; it must never reach a browser, and this app never needs it.

### 6. Deploy on Vercel

1. vercel.com → **Add New** → **Project** → import your GitHub repo.
2. Framework preset: **Next.js** (it detects this).
3. Open **Environment Variables** and add the two values from step 5.
4. **Deploy**. Two minutes later you have a URL such as `reloop-xyz.vercel.app`.

### 7. Point Supabase at your live URL

Back in Supabase: **Authentication** → **URL Configuration**. Set **Site URL** to your Vercel URL
and add it under **Redirect URLs** too. Without this, sign-in works locally but not in production.

### 8. Try it

Open your URL, enter your own `@iitd.ac.in` address, and sign in with the code. Then open
**Settings → your profile** in the app and set your hostel — that is what sorts the marketplace by
walking distance.

---

## Before you let a whole hostel in: the email limit

Supabase's built-in email service is for testing only. It sends roughly **2–4 messages an hour** for
the whole project. With that limit the fourth student to sign in that hour gets nothing and assumes
the app is broken.

Fix it before any real pilot. It is free and takes ten minutes:

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails a month).
2. Verify a domain, or use their test sender to start.
3. In Supabase: **Settings → Authentication → SMTP Settings**, enable custom SMTP and fill in:
   - Host `smtp.resend.com`, port `465`
   - Username `resend`
   - Password: your Resend API key
   - Sender: an address on your verified domain
4. Raise the rate limit under **Authentication → Rate Limits**.

---

## Running it locally

```sh
npm install
cp .env.example .env.local      # paste your two keys in
npm run dev                     # http://localhost:3000
npm test                        # the gate and rental maths
```

Add `http://localhost:3000` to Supabase's Redirect URLs so local sign-in works too.

---

## How the login actually works

A typed email proves nothing, so ReLoop never trusts one. It emails a six-digit code and the code
proves the person can read that inbox.

The domain rule is anchored on the host:

```ts
const IITD_HOST = /^(?:[a-z0-9-]+\.)*iitd\.ac\.in$/;
```

| Address | Result |
|---|---|
| `ch1230456@iitd.ac.in` | allowed |
| `prof@cse.iitd.ac.in` | allowed — departmental sub-domains |
| `attacker@iitd.ac.in.evil.com` | **refused** |

That last one is why the check is written this way. `email.includes('iitd.ac.in')` returns true for
it, and that is a completely different domain controlled by someone else.

The rule is enforced three times: in the browser for a fast error, again in the server action
because a browser check is a convenience and not a control, and a third time by a Postgres trigger
on `auth.users`, so a hand-written API call cannot create an account either. The tests in
`tests/domain.test.ts` cover all three cases, including the look-alike trap.

## Who can edit what

Every table has row-level security, so permission is decided by Postgres and not by the page:

- You can only insert a listing whose `seller_id` is you, and only update or delete your own.
- A conversation is visible to exactly its two students. Nobody else can read a message, whatever
  request they craft.
- Only the buyer can open a conversation, so a seller cannot cold-message someone.
- Photos upload into a folder named after your user id, and you can only write in your own.
- Saved items are yours alone.

This is the thing the earlier Claude-hosted version could not do: there, ownership was enforced in
the page, so a determined user could have edited another student's listing. Here the database
refuses.

## What the design is doing

Listings are grouped by **how far you have to walk** — your hostel, a short walk, across campus —
because on a campus that is the fact that decides whether you bother. Hostels are grouped into zones
in `supabase/schema.sql`; correct them against the real campus map before a pilot, since that table
is what "a short walk" means.

One typeface (Archivo) with weight and tracking carrying the hierarchy, cool stone and paper rather
than cream, one stamped red for every price and primary action, a deep green for anything rented.
Hairline borders instead of shadows. Prices are tabular figures so columns line up. Dark mode follows
the system setting.

Open `design-preview.html` in a browser to see it without installing anything.

## What is here

```
app/(app)/browse      the marketplace, grouped by distance
app/(app)/listing     one item, with the rental quote
app/(app)/sell        four-step listing flow, photos resized in the browser
app/(app)/chats       live chat, with a price-proposal message
app/(app)/saved       your saved items
app/(app)/profile     your details and your listings
app/login             the OTP flow
lib/domain.ts         the IIT Delhi rule
lib/rental.ts         rental quotes and date overlap
supabase/schema.sql   every table, policy and trigger
supabase/trust-and-deals.sql   deals, feedback, wanted board, phone privacy, rental reminders (run second)
tests/                the gate and the maths
```

## What it still does not do

No payments, escrow or held deposits — the app records what you agreed and you settle in person.
No ratings, no moderation queue, no Batch Handover. Those were deliberately left out so the four
things that matter work properly first.

## If something goes wrong

**The code email never arrives.** Check spam. If several people signed in recently you have hit the
built-in email limit — see the Resend section above.

**"Invalid login credentials" or the code is refused.** Codes last one hour and work once. Send a
new one.

**Sign-in works locally but not on Vercel.** Step 7: Site URL and Redirect URLs.

**A student with a valid address cannot sign up.** Check the trigger ran: in SQL Editor,
`select * from pg_trigger where tgname = 'enforce_iitd_domain_on_signup';` should return one row.

**Photos will not upload.** The `listing-photos` bucket comes from the schema file. Confirm it
exists under **Storage**, and that it is marked public.
# Smiley
