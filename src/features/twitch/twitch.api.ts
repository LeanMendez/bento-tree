import { fetchJson, HttpError } from '../../lib/server/http';

/** Estado del canal. `title`/`viewers` solo vienen cuando está en vivo (hoy no se renderizan). */
export interface LiveStatus {
  live: boolean;
  title?: string;
  viewers?: number;
}

export interface TwitchCredentials {
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface StreamsResponse {
  data: { type: string; title: string; viewer_count: number }[];
}

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams';
/** Se renueva el token este margen antes de que venza (vencen en ~60 días). */
export const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** Helix devuelve `data: []` si el canal está offline y un stream `type: 'live'` si está en vivo. */
export function toLiveStatus(response: StreamsResponse): LiveStatus {
  const stream = response.data.find((s) => s.type === 'live');
  return stream ? { live: true, title: stream.title, viewers: stream.viewer_count } : { live: false };
}

export interface TwitchClient {
  getLiveStatus(login: string): Promise<LiveStatus>;
}

/**
 * Cliente Helix con app access token (client credentials).
 * El token se guarda en memoria del isolate hasta `expires_in` menos un margen y se renueva
 * también si Helix responde 401 (token revocado). Lanza ante cualquier error HTTP: el servicio
 * lo convierte en `null`.
 */
export function createTwitchClient(
  { clientId, clientSecret }: TwitchCredentials,
  now: () => number = Date.now,
): TwitchClient {
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && now() < token.expiresAt - TOKEN_EXPIRY_MARGIN_MS) return token.value;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });
    const response = await fetchJson<TokenResponse>(TOKEN_URL, { method: 'POST', body });
    token = { value: response.access_token, expiresAt: now() + response.expires_in * 1000 };
    return token.value;
  }

  async function fetchStreams(login: string): Promise<StreamsResponse> {
    const url = `${STREAMS_URL}?user_login=${encodeURIComponent(login)}`;
    return fetchJson<StreamsResponse>(url, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${await getToken()}` },
    });
  }

  return {
    async getLiveStatus(login: string): Promise<LiveStatus> {
      try {
        return toLiveStatus(await fetchStreams(login));
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) throw error;
        token = null;
        return toLiveStatus(await fetchStreams(login));
      }
    },
  };
}
