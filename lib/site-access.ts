// Server-only password verification and signed, expiring sessions.
const COOKIE = 'wow_log_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
const bytes = (value: string) =>
  Uint8Array.from(value.match(/../g) ?? [], (b) => parseInt(b, 16));

// Only the local launcher sets this process property. Neither environment
// variables nor request headers can opt a hosted deployment into local access.
const LOCAL_ORIGIN = Symbol.for('wow-log-coach.local-origin');
export function localAppOrigin(): string | null {
  const value = (process as unknown as Record<symbol, unknown>)[LOCAL_ORIGIN];
  if (
    typeof value !== 'string' ||
    !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(value)
  )
    return null;
  try {
    // URL validates the port range and canonicalizes the default HTTP port.
    return new URL(value).origin;
  } catch {
    return null;
  }
}
/** Exact launcher address also rejects DNS rebinding and forged Host headers. */
export function localPageAllowed(requestHeaders: Pick<Headers, 'get'>) {
  const origin = localAppOrigin();
  if (!origin) return false;
  return (
    requestHeaders.get('host') === new URL(origin).host &&
    (!requestHeaders.get('origin') ||
      requestHeaders.get('origin') === origin) &&
    requestHeaders.get('sec-fetch-site') !== 'cross-site'
  );
}
export function localRequestAllowed(request: Request) {
  const origin = localAppOrigin();
  return (
    origin !== null &&
    new URL(request.url).origin === origin &&
    localPageAllowed(request.headers)
  );
}

function settings() {
  const hash = process.env.SITE_PASSWORD_HASH ?? '';
  const secret = process.env.SITE_SESSION_SECRET ?? '';
  const match = /^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(
    hash,
  );
  return match && /^[a-f0-9]{64}$/.test(secret)
    ? { hash, secret, salt: match[1], digest: match[2] }
    : null;
}

export function passwordConfigured() {
  return settings() !== null;
}

export async function verifyPassword(password: string) {
  const config = settings();
  if (!config || password.length < 1 || password.length > 256) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const digest = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: bytes(config.salt),
      iterations: 100000,
    },
    key,
    256,
  );
  const actual = new Uint8Array(digest),
    expected = bytes(config.digest);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSession(now = Date.now()) {
  const config = settings();
  if (!config) throw new Error('Password access is not configured.');
  const issued = Math.floor(now / 1000),
    expires = issued + SESSION_SECONDS;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const payload = `v1.${issued}.${expires}.${nonce}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(config.secret),
    encoder.encode(`${payload}.${config.hash}`),
  );
  return `${payload}.${hex(signature)}`;
}

export async function validSession(token: string, now = Date.now()) {
  const config = settings();
  if (!config || token.length > 256) return false;
  const match =
    /^(v1\.(\d{1,12})\.(\d{1,12})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const issued = Number(match[2]),
    expires = Number(match[3]),
    seconds = Math.floor(now / 1000);
  if (
    issued > seconds + 30 ||
    expires <= seconds ||
    expires - issued !== SESSION_SECONDS
  )
    return false;
  return crypto.subtle.verify(
    'HMAC',
    await signingKey(config.secret),
    bytes(match[4]),
    encoder.encode(`${match[1]}.${config.hash}`),
  );
}

export async function hasSession(cookieHeader: string | null) {
  const matches = (cookieHeader ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.startsWith(COOKIE + '='));
  // Ambiguous/shadowed cookies fail closed.
  return (
    matches.length === 1 && validSession(matches[0].slice(COOKIE.length + 1))
  );
}

export function sessionCookie(token: string, request: Request, clear = false) {
  const url = new URL(request.url);
  const local =
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${local ? '' : '; Secure'}`;
}

export function sameOrigin(request: Request) {
  return (
    request.headers.get('origin') === new URL(request.url).origin &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  );
}

export function accessError(message: string, status: number) {
  return Response.json(
    {
      error: {
        code: status === 401 ? 'AUTH_REQUIRED' : 'ACCESS_ERROR',
        message,
      },
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

export async function requireApiSession(request: Request) {
  if (localAppOrigin()) {
    if (!localRequestAllowed(request))
      return accessError('Use the local address printed by the launcher.', 403);
  } else {
    if (!passwordConfigured())
      return accessError('Password access is not configured.', 503);
    if (!(await hasSession(request.headers.get('cookie'))))
      return accessError('Unlock the site to continue.', 401);
  }
  // The passwordless local server still protects its API credentials and quota.
  if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request))
    return accessError('Use this site to submit the request.', 403);
  return null;
}

const attempts = new Map<string, { count: number; until: number }>();
export function allowLoginAttempt(request: Request, now = Date.now()) {
  for (const [key, entry] of attempts)
    if (entry.until <= now) attempts.delete(key);
  // CF-Connecting-IP is set by the edge. Ignore untrusted X-Forwarded-For.
  const ip =
    request.headers.get('cf-connecting-ip')?.slice(0, 64) || 'local-or-unknown';
  let entry = attempts.get(ip);
  if (!entry) {
    if (attempts.size >= 2000) return false;
    entry = { count: 0, until: now + 15 * 60_000 };
    attempts.set(ip, entry);
  }
  entry.count++;
  return entry.count <= 10;
}

export async function loginPassword(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.startsWith('application/x-www-form-urlencoded')
  )
    return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = '',
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const values = new URLSearchParams(text).getAll('password');
  return values.length === 1 ? values[0] : null;
}
