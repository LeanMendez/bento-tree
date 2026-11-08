export const CALENDLY_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';
export const CALENDLY_CSS = 'https://assets.calendly.com/assets/external/widget.css';
export const LOAD_TIMEOUT_MS = 5000;

interface CalendlyApi {
  initPopupWidget(options: { url: string }): void;
}

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

let pending: Promise<CalendlyApi> | null = null;

/** Test hook: forget the cached load. */
export function resetCalendlyLoader(): void {
  pending = null;
}

/** Injects widget.js + widget.css once; concurrent callers share one promise. A failure allows a later retry. */
export function loadCalendly(doc: Document = document, timeoutMs = LOAD_TIMEOUT_MS): Promise<CalendlyApi> {
  if (pending) return pending;
  const { promise, resolve, reject } = Promise.withResolvers<CalendlyApi>();
  pending = promise;
  const win = doc.defaultView;
  if (win?.Calendly) {
    resolve(win.Calendly);
    return promise;
  }
  if (!doc.querySelector(`link[href="${CALENDLY_CSS}"]`)) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = CALENDLY_CSS;
    doc.head.appendChild(link);
  }
  const script = doc.createElement('script');
  script.src = CALENDLY_SCRIPT;
  script.async = true;
  const timer = setTimeout(() => reject(new Error('Calendly load timeout')), timeoutMs);
  script.onload = () => {
    clearTimeout(timer);
    const api = doc.defaultView?.Calendly;
    if (api) resolve(api);
    else reject(new Error('Calendly global missing'));
  };
  script.onerror = () => {
    clearTimeout(timer);
    reject(new Error('Calendly load failed'));
  };
  doc.head.appendChild(script);
  promise.catch(() => {
    if (pending === promise) pending = null;
  });
  return promise;
}

/** Opens the popup; if the widget cannot load, opens the link in a new tab instead. */
export async function openCalendly(
  url: string,
  load: () => Promise<CalendlyApi> = () => loadCalendly(),
  openFallback: (url: string) => void = (u) => window.open(u, '_blank', 'noopener,noreferrer'),
): Promise<'popup' | 'fallback'> {
  try {
    const api = await load();
    api.initPopupWidget({ url });
    return 'popup';
  } catch {
    openFallback(url);
    return 'fallback';
  }
}

/** Wires every `[data-calendly]` link: preload on intent, popup on click. */
export function bindCalendly(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLAnchorElement>('a[data-calendly]')) {
    const preload = () => void loadCalendly().catch(() => {});
    el.addEventListener('pointerenter', preload, { once: true });
    el.addEventListener('focus', preload, { once: true });
    el.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void openCalendly(el.href);
    });
  }
}
