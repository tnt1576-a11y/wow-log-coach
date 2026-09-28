import { APP_VERSION } from '@/lib/version';
// Public, non-sensitive liveness only; quota/configuration require a session.
export async function GET() {
  return Response.json(
    { ok: true, version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
