import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  hasSession,
  localAppOrigin,
  localPageAllowed,
} from '@/lib/site-access';
import { Coach } from './coach';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const requestHeaders = await headers();
  const localMode = localAppOrigin() !== null;
  if (localMode) {
    if (!localPageAllowed(requestHeaders)) notFound();
  } else if (!(await hasSession(requestHeaders.get('cookie')))) {
    redirect('/login');
  }
  return <Coach localMode={localMode} />;
}
