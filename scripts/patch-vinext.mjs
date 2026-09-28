import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Narrow, reproducible workaround for the locked beta. Keep the source anchors
// strict so a dependency upgrade cannot silently receive an incompatible patch.
export function patchServerSource(source) {
  if (source.includes('// wow-coach: disconnected response guard v1'))
    return source;
  const edits = [
    [
      'async function sendWebResponse(webResponse, req, res, compress) {',
      `async function sendWebResponse(webResponse, req, res, compress) {
  // wow-coach: disconnected response guard v1
  if (res.destroyed || res.writableEnded) { cancelResponseBody(webResponse); return; }`,
    ],
    [
      'function nodeToWebRequest(req, urlOverride, prerenderSecret, i18nConfig, authorizeOnDemandRevalidate) {',
      `function nodeToWebRequest(req, urlOverride, prerenderSecret, i18nConfig, authorizeOnDemandRevalidate, res) {
  const disconnect = new AbortController();
  const abort = () => disconnect.abort();
  const close = () => { if (!res.writableFinished) abort(); req.removeListener('aborted', abort); };
  req.once('aborted', abort);
  res?.once('close', close);
  if (req.aborted || res?.destroyed) abort();`,
    ],
    [
      'return new Request(url, init);',
      'init.signal = disconnect.signal;\n\treturn new Request(url, init);',
    ],
    [
      'nodeToWebRequest(req, rawUrl, prerenderSecret, appRouterI18nConfig, appRouterAuthorizeOnDemandRevalidate);',
      'nodeToWebRequest(req, rawUrl, prerenderSecret, appRouterI18nConfig, appRouterAuthorizeOnDemandRevalidate, res);',
    ],
    [
      'console.error("[vinext] Server error:", e);',
      'if (res.destroyed || res.writableEnded) return;\n\t\t\tconsole.error("[vinext] Server error:", e);',
      2,
    ],
    [
      'await new Promise((resolve) => {\n\t\tserver.listen(port, host, () => {',
      'await new Promise((resolve, reject) => {\n\t\tserver.once("error", reject);\n\t\tserver.listen(port, host, () => {',
      2,
    ],
  ];
  for (const [before, after, count = 1] of edits) {
    if (source.split(before).length !== count + 1)
      throw new Error(
        'The installed vinext server changed. Reinstall the locked dependencies before starting.',
      );
    source = source.replaceAll(before, after);
  }
  return source;
}
export async function applyVinextPatch() {
  const root = new URL('../node_modules/vinext/', import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  if (pkg.version !== '1.0.0-beta.9')
    throw new Error(
      'This launcher requires the locked vinext version. Run SETUP_LOCAL.cmd.',
    );
  const path = new URL('dist/server/prod-server.js', root);
  const original = await readFile(path, 'utf8');
  const patched = patchServerSource(original);
  if (original !== patched) await writeFile(path, patched);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await applyVinextPatch();
