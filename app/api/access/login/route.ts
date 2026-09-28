import {
  accessError,
  allowLoginAttempt,
  createSession,
  loginPassword,
  localAppOrigin,
  localRequestAllowed,
  passwordConfigured,
  sameOrigin,
  sessionCookie,
  verifyPassword,
} from '@/lib/site-access';

export async function POST(request: Request) {
  if (localAppOrigin()) {
    if (!localRequestAllowed(request) || !sameOrigin(request))
      return accessError('Use the local address printed by the launcher.', 403);
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Cache-Control': 'no-store' },
    });
  }
  if (!passwordConfigured())
    return accessError('Password access is not configured.', 503);
  if (!sameOrigin(request))
    return accessError('Open the login page on this site.', 403);
  if (!allowLoginAttempt(request))
    return new Response(
      'Too many attempts. Please wait 15 minutes before trying again.',
      {
        status: 429,
        headers: {
          'Retry-After': '900',
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
    );
  const password = await loginPassword(request);
  if (password === null || !(await verifyPassword(password)))
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/login?error=password',
        'Cache-Control': 'no-store',
      },
    });
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': sessionCookie(await createSession(), request),
      'Cache-Control': 'no-store',
    },
  });
}
