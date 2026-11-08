import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveFromApi, LIVE_POLL_INTERVAL_MS, startLivePoller } from './live-poller';

/** `document` mínimo: estado de visibilidad controlable + evento `visibilitychange`. */
class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function setup(initial: DocumentVisibilityState = 'visible') {
  const visibility = new FakeDocument();
  visibility.visibilityState = initial;
  const fetchLive = vi.fn<() => Promise<boolean | null>>().mockResolvedValue(false);
  const onStatus = vi.fn<(live: boolean) => void>();
  const stop = startLivePoller({ fetchLive, onStatus, visibility });
  return { visibility, fetchLive, onStatus, stop };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startLivePoller', () => {
  it('consulta al cargar y cada 60 s mientras la pestaña está visible', async () => {
    const { fetchLive } = setup();
    expect(fetchLive).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS - 1);
    expect(fetchLive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchLive).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS * 2);
    expect(fetchLive).toHaveBeenCalledTimes(4);
  });

  it('no consulta si la página carga oculta, y consulta apenas se vuelve visible', async () => {
    const { visibility, fetchLive } = setup('hidden');
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS * 3);
    expect(fetchLive).not.toHaveBeenCalled();

    visibility.setVisibility('visible');
    expect(fetchLive).toHaveBeenCalledTimes(1);
  });

  it('pausa al ocultarse y al volver consulta enseguida y reanuda el intervalo', async () => {
    const { visibility, fetchLive } = setup();
    visibility.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS * 5);
    expect(fetchLive).toHaveBeenCalledTimes(1);

    visibility.setVisibility('visible');
    expect(fetchLive).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
    expect(fetchLive).toHaveBeenCalledTimes(3);
  });

  it('no duplica el intervalo con eventos visible repetidos', async () => {
    const { visibility, fetchLive } = setup();
    visibility.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
    expect(fetchLive).toHaveBeenCalledTimes(2);
  });

  it('informa en vivo solo con `true`; null (desconocido) se muestra offline', async () => {
    const { fetchLive, onStatus } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenLastCalledWith(false);

    fetchLive.mockResolvedValueOnce(true);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
    expect(onStatus).toHaveBeenLastCalledWith(true);

    fetchLive.mockResolvedValueOnce(null);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
    expect(onStatus).toHaveBeenLastCalledWith(false);
  });

  it('conserva el último estado si la red falla', async () => {
    const { fetchLive, onStatus } = setup();
    await vi.advanceTimersByTimeAsync(0);
    fetchLive.mockRejectedValueOnce(new TypeError('offline'));
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
    expect(onStatus).toHaveBeenCalledTimes(1);
  });

  it('stop() deja de escuchar visibilidad y cancela el intervalo', async () => {
    const { visibility, fetchLive, stop } = setup();
    stop();
    visibility.setVisibility('hidden');
    visibility.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS * 3);
    expect(fetchLive).toHaveBeenCalledTimes(1);
  });
});

describe('fetchLiveFromApi', () => {
  const fetcherFor = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response);

  it('lee `live` de /api/live', async () => {
    const fetcher = fetcherFor(Response.json({ live: true }));
    expect(await fetchLiveFromApi(fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/api/live');
  });

  it('null si el endpoint no conoce el estado o responde error', async () => {
    expect(await fetchLiveFromApi(fetcherFor(Response.json({ live: null })))).toBeNull();
    expect(await fetchLiveFromApi(fetcherFor(new Response(null, { status: 500 })))).toBeNull();
  });
});
