import { APP_VERSION } from '@/lib/version';
import { requireApiSession } from '@/lib/site-access';
import { credentialsConfigured } from '@/lib/warcraft-logs';
import { quotaStatus, refreshQuotaStatus } from '@/lib/wcl-transport';

export async function GET(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  return Response.json(
    {
      ok: true,
      ...(new URL(request.url).searchParams.get('refresh') === '1'
        ? await refreshQuotaStatus()
        : quotaStatus()),
      configured: credentialsConfigured(),
      version: APP_VERSION,
      scope: 'Retail Mythic+ and raid DPS',
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
