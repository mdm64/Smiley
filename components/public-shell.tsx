import Link from 'next/link';
import { Loop } from '@/components/icons';

/** What someone sees before signing in: the marketplace to look at, nothing to act on. */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public">
      <header className="public-bar">
        <Link href="/browse" className="mark">
          <Loop size={20} />
          &nbsp;ReLoop<span>.</span>
        </Link>
        <span className="small muted public-note">Open to look. Sign in with your IIT Delhi email to message sellers.</span>
        <Link href="/login" className="btn primary" style={{ marginLeft: 'auto' }}>
          Sign in
        </Link>
      </header>
      <main className="public-main">{children}</main>
    </div>
  );
}
