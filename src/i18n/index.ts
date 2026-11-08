import { en } from './en';
import { es } from './es';

export type Strings = typeof es;
export type Lang = 'es' | 'en';

export const LANGS: readonly Lang[] = ['es', 'en'];

const dictionaries: Record<Lang, Strings> = { es, en };

export function getStrings(lang: Lang): Strings {
  return dictionaries[lang];
}

/** Ruta de la home para cada idioma (es = default sin prefijo). */
export function homePath(lang: Lang): string {
  return lang === 'es' ? '/' : '/en/';
}
