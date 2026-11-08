export const LIVE_POLL_INTERVAL_MS = 60_000;

/** Subconjunto de `document` que usa el poller (inyectable en tests sin DOM). */
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface LivePollerOptions {
  /** Devuelve el estado en vivo; `null` = desconocido (se muestra offline). */
  fetchLive: () => Promise<boolean | null>;
  /** Se llama con cada respuesta; los errores de red no la disparan (se conserva el último estado). */
  onStatus: (live: boolean) => void;
  visibility: VisibilitySource;
  intervalMs?: number;
}

/** Interpreta la respuesta de `/api/live`. Cualquier cosa distinta de `live: true` es offline. */
export async function fetchLiveFromApi(
  fetcher: typeof fetch = fetch,
  url = '/api/live',
): Promise<boolean | null> {
  const response = await fetcher(url);
  if (!response.ok) return null;
  const body = (await response.json()) as { live?: unknown };
  return typeof body.live === 'boolean' ? body.live : null;
}

/**
 * Consulta al cargar y cada `intervalMs` solo mientras la pestaña está visible:
 * al ocultarse se pausa; al volver a verse consulta enseguida y reanuda el intervalo.
 * Devuelve una función que detiene el poller.
 */
export function startLivePoller({
  fetchLive,
  onStatus,
  visibility,
  intervalMs = LIVE_POLL_INTERVAL_MS,
}: LivePollerOptions): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;

  const poll = async () => {
    try {
      onStatus((await fetchLive()) === true);
    } catch {
      // Red caída: se conserva el último estado mostrado.
    }
  };

  const resume = () => {
    if (timer !== undefined) return;
    void poll();
    timer = setInterval(() => void poll(), intervalMs);
  };

  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };

  const onVisibilityChange = () => (visibility.visibilityState === 'visible' ? resume() : pause());

  visibility.addEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange();

  return () => {
    visibility.removeEventListener('visibilitychange', onVisibilityChange);
    pause();
  };
}
