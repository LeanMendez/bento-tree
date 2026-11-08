/**
 * Caché compartida de integraciones sobre la Cache API de Cloudflare (gratis, sin cuota de escrituras).
 * El cache es por datacenter: cada colo pide como máximo una vez por TTL.
 */
const CACHE_HOST = 'https://bento-cache.internal';

/**
 * Devuelve el valor cacheado bajo `key` o ejecuta `loader` y lo guarda `ttlSeconds`.
 * `loader` devuelve `null` cuando la fuente falla: ese resultado NO se cachea (se reintenta en la próxima visita).
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T | null>,
): Promise<T | null> {
  const cache = (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default;
  const request = new Request(`${CACHE_HOST}/${encodeURIComponent(key)}`);

  const hit = await cache?.match(request);
  if (hit) return (await hit.json()) as T;

  const value = await loader();
  if (value !== null && cache) {
    await cache.put(
      request,
      new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSeconds}` },
      }),
    );
  }
  return value;
}
