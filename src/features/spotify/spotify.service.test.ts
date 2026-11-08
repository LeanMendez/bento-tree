import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPOTIFY_TOKEN_URL } from './spotify.auth';
import {
  getCurrentPlaylist,
  LAST_PLAYLIST_KEY,
  playlistIdFromContext,
  recentPlaylistIds,
  SPOTIFY_API,
  type PlaylistStore,
} from './spotify.service';

const ME = 'janedoe';
const credentials = { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' };

const ctx = (id: string) => ({ type: 'playlist', uri: `spotify:playlist:${id}` });
const album = { type: 'album', uri: 'spotify:album:a1' };

interface FakePlaylist {
  name: string;
  owner: string;
}

interface Scenario {
  current?: { context: unknown } | null; // null → 204
  recent?: { context: unknown }[];
  playlists?: Record<string, FakePlaylist>;
  failCurrent?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockSpotify({ current = null, recent = [], playlists = {}, failCurrent = false }: Scenario) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === SPOTIFY_TOKEN_URL) return json({ access_token: 'token' });
    if (url === `${SPOTIFY_API}/me`) return json({ id: ME });
    if (url === `${SPOTIFY_API}/me/player/currently-playing`) {
      if (failCurrent) return json({}, 500);
      return current ? json(current) : new Response(null, { status: 204 });
    }
    if (url.startsWith(`${SPOTIFY_API}/me/player/recently-played`)) return json({ items: recent });
    const playlist = url.match(/\/playlists\/([^?]+)\?/);
    if (playlist) {
      const found = playlists[playlist[1]];
      if (!found) return json({ error: 'not found' }, 404);
      return json({
        name: found.name,
        owner: { id: found.owner },
        external_urls: { spotify: `https://open.spotify.com/playlist/${playlist[1]}` },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function memoryStore(initial?: { id: string; name: string; url: string }) {
  const data = new Map<string, string>();
  if (initial) data.set(LAST_PLAYLIST_KEY, JSON.stringify(initial));
  const store = {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => void data.set(key, value)),
  } satisfies PlaylistStore;
  return { store, data };
}

const playlist = (id: string, name: string) => ({ id, name, url: `https://open.spotify.com/playlist/${id}` });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getCurrentPlaylist', () => {
  it('sin secrets devuelve null sin llamar a Spotify ni a KV', async () => {
    const fetchMock = mockSpotify({});
    const { store } = memoryStore(playlist('kv1', 'Guardada'));

    expect(await getCurrentPlaylist({ credentials: { ...credentials, refreshToken: '' }, store })).toBeNull();
    expect(await getCurrentPlaylist({ credentials: {}, store })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('usa la playlist propia que está sonando', async () => {
    const fetchMock = mockSpotify({
      current: { context: ctx('mine1') },
      recent: [{ context: ctx('mine2') }],
      playlists: { mine1: { name: 'Sonando', owner: ME }, mine2: { name: 'Vieja', owner: ME } },
    });
    const { store } = memoryStore();

    expect(await getCurrentPlaylist({ credentials, store })).toEqual(playlist('mine1', 'Sonando'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      `${SPOTIFY_API}/me/player/recently-played?limit=50`,
    );
  });

  it('manda el refresh token con Basic auth', async () => {
    const fetchMock = mockSpotify({
      current: { context: ctx('mine1') },
      playlists: { mine1: { name: 'P', owner: ME } },
    });
    await getCurrentPlaylist({ credentials });

    const [, request] = fetchMock.mock.calls.find(([url]) => url === SPOTIFY_TOKEN_URL)!;
    if (!request) throw new Error('token request sin init');
    expect(request.method).toBe('POST');
    expect(new Headers(request.headers).get('authorization')).toBe(`Basic ${btoa('client:secret')}`);
    expect(String(request.body)).toBe('grant_type=refresh_token&refresh_token=refresh');
  });

  it('si suena una playlist ajena busca la última propia en el historial', async () => {
    mockSpotify({
      current: { context: ctx('other') },
      recent: [{ context: ctx('other') }, { context: album }, { context: ctx('mine2') }],
      playlists: { other: { name: 'Ajena', owner: 'someone' }, mine2: { name: 'Propia', owner: ME } },
    });

    expect(await getCurrentPlaylist({ credentials })).toEqual(playlist('mine2', 'Propia'));
  });

  it('204 (nada sonando) pasa al historial', async () => {
    mockSpotify({
      current: null,
      recent: [{ context: ctx('mine2') }],
      playlists: { mine2: { name: 'Propia', owner: ME } },
    });

    expect(await getCurrentPlaylist({ credentials })).toEqual(playlist('mine2', 'Propia'));
  });

  it('si suena algo sin contexto de playlist pasa al historial', async () => {
    mockSpotify({
      current: { context: album },
      recent: [{ context: null }, { context: ctx('mine2') }],
      playlists: { mine2: { name: 'Propia', owner: ME } },
    });

    expect(await getCurrentPlaylist({ credentials })).toEqual(playlist('mine2', 'Propia'));
  });

  it('ignora playlists inaccesibles (404) del historial', async () => {
    mockSpotify({
      recent: [{ context: ctx('editorial') }, { context: ctx('mine2') }],
      playlists: { mine2: { name: 'Propia', owner: ME } },
    });

    expect(await getCurrentPlaylist({ credentials })).toEqual(playlist('mine2', 'Propia'));
  });

  it('sin playlist propia en vivo ni historial usa la guardada en KV', async () => {
    mockSpotify({ recent: [{ context: ctx('other') }], playlists: { other: { name: 'Ajena', owner: 'x' } } });
    const { store } = memoryStore(playlist('kv1', 'Guardada'));

    expect(await getCurrentPlaylist({ credentials, store })).toEqual(playlist('kv1', 'Guardada'));
    expect(store.put).not.toHaveBeenCalled();
  });

  it('si Spotify falla usa la guardada en KV', async () => {
    mockSpotify({ failCurrent: true });
    const { store } = memoryStore(playlist('kv1', 'Guardada'));

    expect(await getCurrentPlaylist({ credentials, store })).toEqual(playlist('kv1', 'Guardada'));
  });

  it('sin dato en ninguna fuente devuelve null', async () => {
    mockSpotify({});
    const { store } = memoryStore();

    expect(await getCurrentPlaylist({ credentials, store })).toBeNull();
    expect(await getCurrentPlaylist({ credentials })).toBeNull();
  });

  it('KV corrupto se ignora', async () => {
    mockSpotify({});
    const { store, data } = memoryStore();
    data.set(LAST_PLAYLIST_KEY, '{nope');

    expect(await getCurrentPlaylist({ credentials, store })).toBeNull();
  });

  it('escribe en KV solo cuando cambia el id de la playlist', async () => {
    mockSpotify({ current: { context: ctx('mine1') }, playlists: { mine1: { name: 'Sonando', owner: ME } } });

    const same = memoryStore(playlist('mine1', 'Sonando'));
    await getCurrentPlaylist({ credentials, store: same.store });
    expect(same.store.put).not.toHaveBeenCalled();

    const changed = memoryStore(playlist('kv1', 'Guardada'));
    await getCurrentPlaylist({ credentials, store: changed.store });
    expect(changed.store.put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(changed.data.get(LAST_PLAYLIST_KEY)!)).toEqual(playlist('mine1', 'Sonando'));
  });

  it('si falla la escritura en KV igual devuelve la playlist', async () => {
    mockSpotify({ current: { context: ctx('mine1') }, playlists: { mine1: { name: 'Sonando', owner: ME } } });
    const { store } = memoryStore();
    store.put.mockRejectedValueOnce(new Error('quota'));

    expect(await getCurrentPlaylist({ credentials, store })).toEqual(playlist('mine1', 'Sonando'));
  });

  it('si falla el refresh del token devuelve null (sin KV) en vez de lanzar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'invalid_grant' }, 400)),
    );

    expect(await getCurrentPlaylist({ credentials })).toBeNull();
  });
});

describe('parsers', () => {
  it('playlistIdFromContext solo acepta contextos de playlist', () => {
    expect(playlistIdFromContext(ctx('abc'))).toBe('abc');
    expect(playlistIdFromContext({ type: 'playlist', uri: 'spotify:user:janedoe:playlist:abc' })).toBe('abc');
    expect(playlistIdFromContext(album)).toBeNull();
    expect(playlistIdFromContext(null)).toBeNull();
    expect(playlistIdFromContext({ type: 'playlist' })).toBeNull();
  });

  it('recentPlaylistIds conserva el orden y quita repetidos', () => {
    expect(
      recentPlaylistIds({
        items: [{ context: ctx('b') }, { context: album }, { context: ctx('a') }, { context: ctx('b') }],
      }),
    ).toEqual(['b', 'a']);
    expect(recentPlaylistIds({})).toEqual([]);
  });
});
