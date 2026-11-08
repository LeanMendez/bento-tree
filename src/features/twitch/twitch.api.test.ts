import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTwitchClient, TOKEN_EXPIRY_MARGIN_MS, toLiveStatus } from './twitch.api';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
const tokenResponse = (token: string, expiresIn = 3600) =>
  Response.json({ access_token: token, expires_in: expiresIn, token_type: 'bearer' });
const liveStream = { type: 'live', title: 'Coding stream', viewer_count: 42 };

/** Mock de fetch que responde según la URL y registra las llamadas. */
function mockFetch(handlers: { token: () => Response; streams: () => Response }) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    return url.startsWith('https://id.twitch.tv/oauth2/token') ? handlers.token() : handlers.streams();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const tokenCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2/token')).length;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toLiveStatus', () => {
  it('offline cuando Helix no devuelve streams', () => {
    expect(toLiveStatus({ data: [] })).toEqual({ live: false });
  });

  it('en vivo con título y viewers cuando hay un stream live', () => {
    expect(toLiveStatus({ data: [liveStream] })).toEqual({
      live: true,
      title: 'Coding stream',
      viewers: 42,
    });
  });

  it('ignora streams que no son de tipo live', () => {
    expect(toLiveStatus({ data: [{ ...liveStream, type: '' }] })).toEqual({ live: false });
  });
});

describe('createTwitchClient', () => {
  it('pide el app token con client credentials y consulta Helix con Client-Id + Bearer', async () => {
    const fetchMock = mockFetch({
      token: () => tokenResponse('tok-1'),
      streams: () => Response.json({ data: [liveStream] }),
    });

    const status = await createTwitchClient(credentials).getLiveStatus('janedoe');

    expect(status.live).toBe(true);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe('https://id.twitch.tv/oauth2/token');
    expect(tokenInit?.method).toBe('POST');
    expect(String(tokenInit?.body)).toBe(
      'client_id=client-id&client_secret=client-secret&grant_type=client_credentials',
    );
    const [streamsUrl, streamsInit] = fetchMock.mock.calls[1]!;
    expect(streamsUrl).toBe('https://api.twitch.tv/helix/streams?user_login=janedoe');
    expect(streamsInit?.headers).toEqual({ 'Client-Id': 'client-id', Authorization: 'Bearer tok-1' });
  });

  it('reutiliza el token hasta el vencimiento menos el margen y luego lo renueva', async () => {
    let now = 0;
    let issued = 0;
    const fetchMock = mockFetch({
      token: () => tokenResponse(`tok-${++issued}`, 3600),
      streams: () => Response.json({ data: [] }),
    });
    const client = createTwitchClient(credentials, () => now);

    await client.getLiveStatus('janedoe');
    now = 3600_000 - TOKEN_EXPIRY_MARGIN_MS - 1;
    await client.getLiveStatus('janedoe');
    expect(tokenCalls(fetchMock)).toBe(1);

    now = 3600_000 - TOKEN_EXPIRY_MARGIN_MS;
    await client.getLiveStatus('janedoe');
    expect(tokenCalls(fetchMock)).toBe(2);
    const lastInit = fetchMock.mock.calls.at(-1)![1];
    expect(lastInit?.headers).toMatchObject({ Authorization: 'Bearer tok-2' });
  });

  it('renueva el token y reintenta una vez si Helix responde 401', async () => {
    let issued = 0;
    const streams = [new Response(null, { status: 401 }), Response.json({ data: [liveStream] })];
    const fetchMock = mockFetch({
      token: () => tokenResponse(`tok-${++issued}`),
      streams: () => streams.shift()!,
    });

    const status = await createTwitchClient(credentials).getLiveStatus('janedoe');

    expect(status.live).toBe(true);
    expect(tokenCalls(fetchMock)).toBe(2);
  });

  it('lanza si el token falla (credenciales inválidas)', async () => {
    mockFetch({
      token: () => new Response(null, { status: 403 }),
      streams: () => Response.json({ data: [] }),
    });
    await expect(createTwitchClient(credentials).getLiveStatus('janedoe')).rejects.toThrow('HTTP 403');
  });

  it('lanza si Helix sigue respondiendo 401 tras renovar el token', async () => {
    mockFetch({
      token: () => tokenResponse('tok'),
      streams: () => new Response(null, { status: 401 }),
    });
    await expect(createTwitchClient(credentials).getLiveStatus('janedoe')).rejects.toThrow('HTTP 401');
  });

  it('no renueva el token ante otros errores de Helix', async () => {
    const fetchMock = mockFetch({
      token: () => tokenResponse('tok'),
      streams: () => new Response(null, { status: 500 }),
    });
    await expect(createTwitchClient(credentials).getLiveStatus('janedoe')).rejects.toThrow('HTTP 500');
    expect(tokenCalls(fetchMock)).toBe(1);
  });
});
