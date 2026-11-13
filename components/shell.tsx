'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Loop, Home, Heart, Chat, User, Plus, Search } from '@/components/icons';
import type { Profile } from '@/lib/types';
import { initials } from '@/lib/format';

export default function Shell({
  profile,
  savedCount,
  unread,
  children,
}: {
  profile: Profile;
  savedCount: number;
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get('q') ?? '');

  const on = (href: string) => (href === '/browse' ? pathname === '/browse' : pathname.startsWith(href));

  const nav = [
    { href: '/browse', label: 'Marketplace', Icon: Home, badge: 0, dot: false },
    { href: '/saved', label: 'Saved', Icon: Heart, badge: savedCount, dot: false },
    { href: '/chats', label: 'Chats', Icon: Chat, badge: unread, dot: true },
    { href: '/profile', label: 'You', Icon: User, badge: 0, dot: false },
  ];

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <Link href="/browse" className="mark">
          <Loop size={20} />
          &nbsp;ReLoop<span>.</span>
        </Link>

        {nav.map(({ href, label, Icon, badge, dot }) => (
          <Link key={href} href={href} className="raillink" data-on={on(href)}>
            <Icon />
            {label}
            {badge > 0 &&
              (dot ? (
                <span className="dot" title={`${badge} unread`} />
              ) : (
                <span className="count tnum">{badge}</span>
              ))}
          </Link>
        ))}

        <Link href="/sell" className="railsell">
          <Plus /> List an item
        </Link>

        <div className="railfoot">
          <Link href="/profile" className="railuser">
            <span className="avatar">{initials(profile.display_name, profile.email)}</span>
            <span className="who">
              <b>{profile.display_name || 'Your account'}</b>
              <small>{profile.email}</small>
            </span>
          </Link>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse');
            }}
          >
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search cycles, blazers, textbooks…"
              aria-label="Search listings"
            />
          </form>
          <Link href="/sell" className="btn primary" style={{ marginLeft: 'auto' }}>
            <Plus size={16} /> Sell
          </Link>
        </header>
        {children}
      </div>

      <nav className="tabs" aria-label="Main">
        <Link href="/browse" className="tab" data-on={on('/browse')}>
          <Home size={20} /> Market
        </Link>
        <Link href="/saved" className="tab" data-on={on('/saved')}>
          <Heart size={20} /> Saved
        </Link>
        <Link href="/sell" className="tab" data-on={on('/sell')}>
          <span className="sellmark">
            <Plus size={18} />
          </span>
          Sell
        </Link>
        <Link href="/chats" className="tab" data-on={on('/chats')}>
          <Chat size={20} /> Chats
        </Link>
        <Link href="/profile" className="tab" data-on={on('/profile')}>
          <User size={20} /> You
        </Link>
      </nav>
    </div>
  );
}
