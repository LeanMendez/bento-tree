/** Copia texto al portapapeles; `false` si el navegador lo rechaza o no lo soporta. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const FEEDBACK_MS = 2200;
const timers = new WeakMap<Element, number>();

/** Muestra `text` en `el` durante 2,2 s (como el diseño) y vuelve al texto original. */
export function flashText(el: Element, text: string): void {
  const original = el.getAttribute('data-original') ?? el.textContent ?? '';
  el.setAttribute('data-original', original);
  el.textContent = text;
  window.clearTimeout(timers.get(el));
  timers.set(
    el,
    window.setTimeout(() => {
      el.textContent = original;
    }, FEEDBACK_MS),
  );
}
