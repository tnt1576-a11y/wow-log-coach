import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

/** Add missing names without replacing credentials, comments or other settings. */
export function ensureLocalEnv(directory) {
  const path = resolve(directory, '.env.local');
  const created = !existsSync(path);
  if (created)
    writeFileSync(
      path,
      '# Your Warcraft Logs API v2 client. No local app password is needed.\n',
      { mode: 0o600 },
    );
  const original = readFileSync(path, 'utf8');
  const values = parseEnv(original.replace(/^\uFEFF/, ''));
  const missing = ['WCL_CLIENT_ID', 'WCL_CLIENT_SECRET'].filter(
    (key) => !Object.hasOwn(values, key),
  );
  if (missing.length)
    appendFileSync(
      path,
      (original && !original.endsWith('\n') ? '\n' : '') +
        missing.map((key) => key + '=').join('\n') +
        '\n',
    );
  return {
    path,
    created,
    added: missing,
    configured: Boolean(values.WCL_CLIENT_ID && values.WCL_CLIENT_SECRET),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = ensureLocalEnv(process.cwd());
  console.log(
    (result.created ? 'Created' : 'Checked') +
      ' .env.local. Both Warcraft Logs credential fields are present.',
  );
  if (!result.configured)
    console.log(
      'Fill WCL_CLIENT_ID and WCL_CLIENT_SECRET in .env.local for real logs. Existing values are preserved.',
    );
}
