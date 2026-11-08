import { cached } from '../../lib/server/cache';
import { fetchJson } from '../../lib/server/http';

export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/** El access token dura 1 h: se reutiliza 55 min para no usarlo vencido. */
const ACCESS_TOKEN_TTL_SECONDS = 55 * 60;

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface TokenResponse {
  access_token?: string;
}

/** Credenciales completas o `null` si falta alguna (sin secrets → fallback). */
export function completeCredentials(credentials: Partial<SpotifyCredentials>): SpotifyCredentials | null {
  const { clientId, clientSecret, refreshToken } = credentials;
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

/** Cambia el refresh token por un access token nuevo (flujo Authorization Code). */
export async function refreshAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: SpotifyCredentials): Promise<string | null> {
  const token = await fetchJson<TokenResponse>(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  return token.access_token || null;
}

export function getAccessToken(credentials: SpotifyCredentials): Promise<string | null> {
  return cached('spotify:access-token', ACCESS_TOKEN_TTL_SECONDS, () => refreshAccessToken(credentials));
}
