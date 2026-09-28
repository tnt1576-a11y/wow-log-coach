import {
  accessError,
  sameOrigin,
  sessionCookie,
  localAppOrigin,
  localRequestAllowed,
} from '@/lib/site-access';

export async function POST(request: Request) {
  const localMode = localAppOrigin() !== null;
  if (localMode && !localRequestAllowed(request))
    return accessError('Use the local address printed by the launcher.', 403);
  if (!sameOrigin(request))
    return accessError('Use this site to sign out.', 403);
  return new Response(null, {
    status: 303,
    headers: {
      Location: localMode ? '/' : '/login',
      'Set-Cookie': sessionCookie('', request, true),
      'Cache-Control': 'no-store',
    },
  });
}
