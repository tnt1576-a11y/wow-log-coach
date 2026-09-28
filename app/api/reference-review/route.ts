import { analysisContext } from '@/lib/analysis-context';
import { requireApiSession } from '@/lib/site-access';
import { referenceReview, referenceReviewSchema } from '@/lib/reference-review';
import { errorResponse } from '@/lib/http';

export async function POST(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const input = referenceReviewSchema.parse(await request.json());
    return Response.json(
      await analysisContext.run(
        {
          signal: request.signal,
          publish: () => {},
          requests: 0,
          cacheHits: 0,
        },
        () => referenceReview(input),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
