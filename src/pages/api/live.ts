import type { APIRoute } from 'astro';
import { site } from '../../config/site';
import { getLiveStatus } from '../../features/twitch/twitch.service';

export const prerender = false;

/** `{ live: null }` = estado desconocido (sin secrets o Twitch caído): el cliente lo trata como offline. */
export const GET: APIRoute = async () => {
  const status = await getLiveStatus(site.twitch.login);
  return Response.json(
    { live: status?.live ?? null },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
};
