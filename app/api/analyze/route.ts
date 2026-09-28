import { requireApiSession } from '@/lib/site-access';
import { analyze } from '@/lib/analyze';
import { analysisRequestSchema } from '@/lib/domain';
import { demoAnalysis } from '@/lib/demo';
import { errorResponse } from '@/lib/http';
import { streamAnalysis } from '@/lib/analysis-stream';
import { analysisContext } from '@/lib/analysis-context';

export async function POST(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const input = analysisRequestSchema.parse(await request.json());
    if (
      /\/reports\/example/i.test(input.reportUrl) ||
      input.reportUrl.trim() === 'example'
    ) {
      return Response.json({
        ...demoAnalysis,
        generatedAt: new Date().toISOString(),
      });
    }
    if (request.headers.get('accept')?.includes('application/x-ndjson'))
      return streamAnalysis(request, input);
    return Response.json(
      await analysisContext.run(
        {
          signal: AbortSignal.any([
            request.signal,
            AbortSignal.timeout(15 * 60_000),
          ]),
          requests: 0,
          cacheHits: 0,
          publish: () => {},
        },
        () => analyze(input),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
