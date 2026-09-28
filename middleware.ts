import { NextResponse } from 'next/server';

// Prevent browser/shared-cache reuse of reports after the site is locked.
// Authorization is checked independently in the server page and every API.
export function middleware() {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}
export const config = { matcher: ['/', '/login', '/api/:path*'] };
