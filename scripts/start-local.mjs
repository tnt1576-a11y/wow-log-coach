import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyVinextPatch } from './patch-vinext.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
let localServer;
try {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error(
      'Node.js 24 or newer is required. Run SETUP_LOCAL.cmd after upgrading.',
    );
  try {
    process.loadEnvFile('.env.local');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  process.env.NODE_ENV = 'production';
  await access('dist/server/index.js');
  await applyVinextPatch();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be a number between 1 and 65535.');
  // A trusted process marker enables password-free access only in this launcher.
  // No environment value, request header or URL can enable this in the hosted Worker.
  const url = 'http://127.0.0.1:' + port;
  Object.defineProperty(process, Symbol.for('wow-log-coach.local-origin'), {
    value: url,
    writable: false,
    configurable: false,
  });
  const { startProdServer } = await import('vinext/server/prod-server');
  const { server } = await startProdServer({ port, host: '127.0.0.1' });
  localServer = server;
  const response = await fetch(url + '/api/health', {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    server.close();
    throw new Error(
      'The server started but its health check failed. Run SETUP_LOCAL.cmd to rebuild.',
    );
  }
  console.log(`WoW Log Coach is ready: ${url}`);
  console.log('Keep this window open. Press Ctrl+C to stop.');
  if (process.argv.includes('--open')) {
    const child =
      process.platform === 'win32'
        ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          })
        : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
            detached: true,
            stdio: 'ignore',
          });
    child.on('error', () => console.log('Open the URL above in your browser.'));
    child.unref();
  }
} catch (error) {
  localServer?.close();
  console.error(
    'Could not start WoW Log Coach:',
    error.code === 'ENOENT'
      ? 'Build or dependency files are missing. Run SETUP_LOCAL.cmd first.'
      : error.code === 'EADDRINUSE'
        ? 'The port is already in use. Close the other server, or set PORT in .env.local.'
        : error.message,
  );
  process.exitCode = 1;
}
