import type { AnalysisResult } from './domain';
import type { AnalysisProgress } from './analysis-context';
import type { AnalysisMessage } from './analysis-stream';

export async function readAnalysisResponse(
  response: Response,
  onProgress: (value: AnalysisProgress) => void,
  onActivity: () => void,
): Promise<AnalysisResult> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const body = (await response.json()) as AnalysisResult & {
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(body?.error?.message ?? 'Comparison failed.');
    return body as AnalysisResult;
  }
  if (!response.body)
    throw new Error('The server returned no comparison stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: AnalysisResult | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    const message = JSON.parse(line) as AnalysisMessage;
    if (message.type === 'error') throw new Error(message.error.message);
    if (message.type === 'progress') onProgress(message.progress);
    if (message.type === 'result') result = message.result;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      onActivity();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) {
        consume(buffer);
        break;
      }
    }
    if (!result)
      throw new Error(
        'The connection ended before the comparison finished. Retry to reuse cached responses.',
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
