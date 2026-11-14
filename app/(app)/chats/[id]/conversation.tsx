'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendMessage } from '@/app/(app)/actions';
import { rupees, priceLabel } from '@/lib/format';
import { initials } from '@/lib/format';
import { Send, Image as ImageIcon } from '@/components/icons';
import type { Listing, Message, Profile } from '@/lib/types';

type Thread = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_at: string;
};

export default function Conversation({
  me,
  threads,
  currentId,
  people,
  listings,
  initialMessages,
  dealPanel,
  otherStatsText,
}: {
  me: Profile;
  threads: Thread[];
  currentId: string;
  people: Profile[];
  listings: Listing[];
  initialMessages: Message[];
  dealPanel?: React.ReactNode;
  otherStatsText?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [offering, setOffering] = useState(false);
  const [amount, setAmount] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const current = threads.find((t) => t.id === currentId)!;
  const listing = listings.find((l) => l.id === current.listing_id);
  const otherId = current.buyer_id === me.id ? current.seller_id : current.buyer_id;
  const other = people.find((p) => p.id === otherId);

  useEffect(() => setMessages(initialMessages), [initialMessages, currentId]);

  // New messages arrive over the realtime channel, so neither side has to reload.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${currentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${currentId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      // A deal changing on the other side (confirmed, returned, cancelled) refreshes the panel.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals', filter: `conversation_id=eq.${currentId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentId, router]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    const offer = offering ? Number(amount) : undefined;
    if (!body && !offer) return;

    const text = offer ? body || `How about ${rupees(offer)}?` : body;
    setDraft('');
    setAmount('');
    setOffering(false);

    // Shown immediately; the realtime insert reconciles by id.
    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      conversation_id: currentId,
      sender_id: me.id,
      body: text,
      offer_amount: offer ?? null,
      is_auto: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    await sendMessage(currentId, text, offer);
    setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
  };

  return (
    <div className="chat" data-view="convo">
      <aside className="threads">
        {threads.map((t) => {
          const l = listings.find((x) => x.id === t.listing_id);
          const who = people.find((p) => p.id === (t.buyer_id === me.id ? t.seller_id : t.buyer_id));
          return (
            <Link key={t.id} href={`/chats/${t.id}`} className="thread" data-on={t.id === currentId}>
              {l?.image_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image_urls[0]} alt="" />
              ) : (
                <span className="avatar">{initials(who?.display_name ?? '', who?.email ?? '?')}</span>
              )}
              <span className="t">
                <b>{who?.display_name || 'IIT Delhi student'}</b>
                <span>{l?.title ?? 'Listing removed'}</span>
              </span>
            </Link>
          );
        })}
      </aside>

      <section className="convo">
        <header className="convo-head">
          {listing?.image_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.image_urls[0]} alt="" />
          ) : (
            <span className="avatar">{initials(other?.display_name ?? '', other?.email ?? '?')}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <b>{other?.display_name || 'IIT Delhi student'}</b>
            {otherStatsText && <div className="small muted">{otherStatsText}</div>}
            <div className="small muted">
              {listing ? (
                <Link href={`/listing/${listing.id}`}>
                  {listing.title} — {priceLabel(listing).value} {priceLabel(listing).suffix}
                </Link>
              ) : (
                'This listing has been removed'
              )}
            </div>
          </div>
          <Link href="/chats" className="btn quiet" style={{ marginLeft: 'auto' }}>
            All chats
          </Link>
        </header>

        {dealPanel}

        <div className="bubbles">
          {messages.length === 0 && (
            <p className="muted small">No messages yet. Open with what you want to know.</p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === me.id;
            if (m.is_auto) {
              return (
                <div key={m.id} className="bubble auto">
                  <span className="auto-tag">Automatic message</span>
                  {m.body}
                  <time>
                    {new Date(m.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
              );
            }
            return (
              <div
                key={m.id}
                className={`bubble${mine ? ' mine' : ''}${m.offer_amount && !mine ? ' offer' : ''}`}
              >
                {m.offer_amount && !mine && (
                  <div>
                    <b>{rupees(m.offer_amount)}</b> offered
                  </div>
                )}
                {m.body}
                <time>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <form className="composer" onSubmit={submit}>
          {offering && (
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="₹"
              style={{ maxWidth: 110 }}
              aria-label="Offer amount in rupees"
            />
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={offering ? 'Add a note (optional)' : 'Ask a question, or agree a time'}
            maxLength={2000}
            aria-label="Message"
          />
          <button
            type="button"
            className="btn"
            onClick={() => setOffering((v) => !v)}
            aria-pressed={offering}
            title="Propose a price"
          >
            ₹
          </button>
          <button className="btn primary" aria-label="Send">
            <Send />
          </button>
        </form>
      </section>
    </div>
  );
}
