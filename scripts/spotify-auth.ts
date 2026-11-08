/**
 * Flujo OAuth único para obtener el refresh token de Spotify (ver docs/spotify.md).
 * Uso: `pnpm spotify:auth` con SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en `.dev.vars` o en el entorno.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 8888;
const REDIRECT_URI = `http://${HOST}:${PORT}/callback`;
const SCOPES = [
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-read-playback-state',
  'playlist-read-private',
];

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Faltan SPOTIFY_CLIENT_ID y/o SPOTIFY_CLIENT_SECRET (en .dev.vars o en el entorno).');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authorizeUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: SCOPES.join(' '),
  redirect_uri: REDIRECT_URI,
  state,
})}`;

async function exchangeCode(code: string): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
  });
  const body = (await response.json()) as { refresh_token?: string; error_description?: string };
  if (!response.ok || !body.refresh_token) {
    throw new Error(`Spotify respondió ${response.status}: ${body.error_description ?? 'sin refresh_token'}`);
  }
  return body.refresh_token;
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(command, [url], { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const finish = (status: number, message: string) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
    server.close();
  };

  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (error || !code || url.searchParams.get('state') !== state) {
    console.error(`Autorización fallida: ${error ?? 'state inválido o sin code'}`);
    finish(400, 'Autorización fallida. Revisá la terminal.');
    process.exitCode = 1;
    return;
  }

  try {
    const refreshToken = await exchangeCode(code);
    console.log('\nRefresh token (guardalo como SPOTIFY_REFRESH_TOKEN):\n');
    console.log(refreshToken);
    finish(200, 'Listo. Ya podés cerrar esta pestaña y volver a la terminal.');
  } catch (exchangeError) {
    console.error(exchangeError);
    finish(500, 'No se pudo canjear el code. Revisá la terminal.');
    process.exitCode = 1;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Esperando el callback en ${REDIRECT_URI}`);
  console.log(`Si el navegador no se abre, entrá a:\n\n${authorizeUrl}\n`);
  openBrowser(authorizeUrl);
});
