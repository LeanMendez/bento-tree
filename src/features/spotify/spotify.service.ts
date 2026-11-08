import { cached } from '../../lib/server/cache';
import { fetchJson, fetchOk, HttpError, orNull } from '../../lib/server/http';
import { completeCredentials, getAccessToken, type SpotifyCredentials } from './spotify.auth';

export const SPOTIFY_API = 'https://api.spotify.com/v1';
/** Clave KV con la última playlist propia encontrada (respaldo cuando Spotify no informa ninguna). */
export const LAST_PLAYLIST_KEY = 'spotify:last-playlist';

const RESULT_TTL_SECONDS = 2 * 60;
const PLAYLIST_TTL_SECONDS = 60 * 60;
const ME_TTL_SECONDS = 24 * 60 * 60;

export interface PlaylistData {
  id: string;
  name: string;
  url: string;
}

/** Subconjunto de KV que usa el servicio (`env.BENTO_KV` lo cumple). */
export interface PlaylistStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface SpotifyDeps {
  credentials: Partial<SpotifyCredentials>;
  store?: PlaylistStore;
}

interface PlaybackContext {
  type?: string;
  uri?: string;
}

interface CurrentlyPlayingResponse {
  context?: PlaybackContext | null;
}

interface RecentlyPlayedResponse {
  items?: { context?: PlaybackContext | null }[];
}

interface PlaylistResponse {
  name?: string;
  owner?: { id?: string };
  external_urls?: { spotify?: string };
}

/** Metadata de una playlist; `owner` null = inaccesible (404/403), nunca es propia. */
interface PlaylistMeta extends PlaylistData {
  owner: string | null;
}

/** Id de la playlist si el contexto de reproducción es una playlist (`spotify:playlist:<id>`). */
export function playlistIdFromContext(context: PlaybackContext | null | undefined): string | null {
  if (context?.type !== 'playlist' || !context.uri) return null;
  return context.uri.split(':').at(-1) || null;
}

/** Ids de playlist del historial, del más reciente al más viejo, sin repetir. */
export function recentPlaylistIds(response: RecentlyPlayedResponse): string[] {
  const ids = (response.items ?? []).map((item) => playlistIdFromContext(item.context));
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

function parseStored(raw: string | null): PlaylistData | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PlaylistData>;
    return value.id && value.name && value.url ? { id: value.id, name: value.name, url: value.url } : null;
  } catch {
    return null;
  }
}

function createApi(accessToken: string) {
  const init: RequestInit = { headers: { Authorization: `Bearer ${accessToken}` } };
  const get = <T>(path: string) => fetchJson<T>(`${SPOTIFY_API}${path}`, init);

  return {
    myId: () =>
      cached('spotify:me', ME_TTL_SECONDS, async () => (await get<{ id?: string }>('/me')).id || null),

    /** 204 No Content = no está sonando nada. */
    async currentContext(): Promise<PlaybackContext | null> {
      const response = await fetchOk(`${SPOTIFY_API}/me/player/currently-playing`, init);
      if (response.status === 204) return null;
      return ((await response.json()) as CurrentlyPlayingResponse).context ?? null;
    },

    recentlyPlayed: () => get<RecentlyPlayedResponse>('/me/player/recently-played?limit=50'),

    playlist: (id: string) =>
      cached(`spotify:playlist:${id}`, PLAYLIST_TTL_SECONDS, async (): Promise<PlaylistMeta> => {
        try {
          const playlist = await get<PlaylistResponse>(
            `/playlists/${encodeURIComponent(id)}?fields=name,owner(id),external_urls`,
          );
          return {
            id,
            name: (playlist.name ?? '').trim(),
            url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${id}`,
            owner: playlist.owner?.id ?? null,
          };
        } catch (error) {
          // Playlists editoriales o privadas de terceros: no son propias.
          if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
            return { id, name: '', url: '', owner: null };
          }
          throw error;
        }
      }),
  };
}

/** Playlist propia que suena ahora o, si no, la última propia del historial. */
async function findOwnPlaylist(credentials: SpotifyCredentials): Promise<PlaylistData | null> {
  const accessToken = await getAccessToken(credentials);
  if (!accessToken) return null;
  const api = createApi(accessToken);

  const myId = await api.myId();
  if (!myId) return null;
  const ownPlaylist = async (id: string): Promise<PlaylistData | null> => {
    const meta = await api.playlist(id);
    return meta && meta.owner === myId && meta.name ? { id: meta.id, name: meta.name, url: meta.url } : null;
  };

  const nowId = playlistIdFromContext(await api.currentContext());
  const now = nowId ? await ownPlaylist(nowId) : null;
  if (now) return now;

  for (const id of recentPlaylistIds(await api.recentlyPlayed())) {
    if (id === nowId) continue;
    const recent = await ownPlaylist(id);
    if (recent) return recent;
  }
  return null;
}

async function resolvePlaylist(
  credentials: SpotifyCredentials,
  store: PlaylistStore | undefined,
): Promise<PlaylistData | null> {
  const found = await orNull('spotify', () => findOwnPlaylist(credentials));
  const stored = store ? parseStored(await orNull('spotify:kv', () => store.get(LAST_PLAYLIST_KEY))) : null;

  if (!found) return stored;
  // KV free: 1.000 escrituras/día → solo se escribe cuando cambia la playlist.
  if (store && found.id !== stored?.id) {
    await orNull('spotify:kv', () => store.put(LAST_PLAYLIST_KEY, JSON.stringify(found)));
  }
  return found;
}

/**
 * Playlist para el footer: la propia que suena → la última propia del historial → la guardada en KV.
 * `null` (sin secrets o sin dato) → el footer muestra la playlist default.
 */
export async function getCurrentPlaylist({ credentials, store }: SpotifyDeps): Promise<PlaylistData | null> {
  const complete = completeCredentials(credentials);
  if (!complete) return null;
  return orNull('spotify', () =>
    cached('spotify:current-playlist', RESULT_TTL_SECONDS, () => resolvePlaylist(complete, store)),
  );
}
