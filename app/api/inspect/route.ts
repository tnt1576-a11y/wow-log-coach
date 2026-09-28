import { analysisContext } from '@/lib/analysis-context';
import { requireApiSession } from '@/lib/site-access';
import { z } from 'zod';
import { demoInspection } from '@/lib/demo';
import { errorResponse } from '@/lib/http';
import { inspectReport } from '@/lib/warcraft-logs';

const schema = z.object({ reportUrl: z.string().min(1) });

export async function POST(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const input = schema.parse(await request.json());
    if (
      /\/reports\/example/i.test(input.reportUrl) ||
      input.reportUrl.trim() === 'example'
    ) {
      return Response.json(demoInspection);
    }
    return Response.json(
      await analysisContext.run(
        {
          signal: request.signal,
          publish: () => {},
          requests: 0,
          cacheHits: 0,
        },
        () => inspectReport(input.reportUrl),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
