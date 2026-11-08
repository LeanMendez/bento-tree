const DEFAULT_TIMEOUT_MS = 4000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} en ${url}`);
  }
}

/** fetch con timeout; lanza `HttpError` si la respuesta no es 2xx. */
export async function fetchOk(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new HttpError(response.status, url);
  return response;
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  return (await fetchOk(url, init, timeoutMs)).json() as Promise<T>;
}

/**
 * Ejecuta `task` y convierte cualquier error en `null` (logueado): las tiles muestran su fallback
 * en vez de romper la página.
 */
export async function orNull<T>(label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    console.error(`[${label}]`, error);
    return null;
  }
}
