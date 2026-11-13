import { Suspense } from 'react';
import LoginForm from './form';
import { Loop } from '@/components/icons';

export default function LoginPage() {
  return (
    <main className="auth">
      <section className="auth-tell">
        <div>
          <div className="mark" style={{ padding: '0 0 34px' }}>
            <Loop size={22} />
            &nbsp;ReLoop<span>.</span>
          </div>
          <h1>Everything the final years are leaving behind.</h1>
          <p className="lede">
            Fans, cycles, blazers, kettles and second-hand textbooks, from students a few hostels
            away. Arrange it here, collect it on foot.
          </p>
          <div className="ledger">
            <div>
              <b className="tnum">15</b>
              <span>hostels, sorted by how far you actually have to walk</span>
            </div>
            <div>
              <b className="tnum">₹0</b>
              <span>held by us — you pay each other directly, in person</span>
            </div>
            <div>
              <b>iitd</b>
              <span>only: every account is a verified institute address</span>
            </div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 32 }}>
          A student project. Not affiliated with the IIT Delhi administration.
        </p>
      </section>

      <section className="auth-do">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
