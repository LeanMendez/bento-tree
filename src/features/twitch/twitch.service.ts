import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from 'astro:env/server';
import { cached } from '../../lib/server/cache';
import { orNull } from '../../lib/server/http';
import { createTwitchClient, type LiveStatus, type TwitchClient } from './twitch.api';

export const LIVE_TTL_SECONDS = 60;

/** Un cliente por isolate: conserva el app token entre requests. */
let client: TwitchClient | null = null;

/** Estado en vivo de `login`, cacheado 60 s. `null` sin secrets o ante cualquier error. */
export async function getLiveStatus(login: string): Promise<LiveStatus | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  client ??= createTwitchClient({ clientId: TWITCH_CLIENT_ID, clientSecret: TWITCH_CLIENT_SECRET });
  const twitch = client;
  return cached(`twitch-live:${login}`, LIVE_TTL_SECONDS, () =>
    orNull('twitch', () => twitch.getLiveStatus(login)),
  );
}
