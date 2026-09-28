import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { localAppOrigin, localPageAllowed } from '@/lib/site-access';
import { APP_VERSION } from '@/lib/version';
import { LockKeyhole } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Unlock — WoW Log Coach',
  robots: { index: false, follow: false },
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (localAppOrigin()) {
    if (!localPageAllowed(await headers())) notFound();
    redirect('/');
  }
  const { error } = await searchParams;
  return (
    <main className="site-login">
      <section>
        <span className="site-login-icon">
          <LockKeyhole size={26} />
        </span>
        <p className="eyebrow">WOW LOG COACH</p>
        <p aria-label={'Version ' + APP_VERSION}>v{APP_VERSION}</p>
        <h1>Your next key starts here.</h1>
        <p>Enter your password to open the coach.</p>
        <form action="/api/access/login" method="post">
          <label htmlFor="site-password">Password</label>
          <input
            id="site-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
          {error === 'password' && (
            <p className="login-error" role="alert">
              That password did not match. Try again.
            </p>
          )}
          <button type="submit">Unlock coach</button>
        </form>
        <p className="login-note">
          Stay signed in for 7 days on this browser. Use “Lock site” when you’re
          done on a shared device.
        </p>
      </section>
    </main>
  );
}
