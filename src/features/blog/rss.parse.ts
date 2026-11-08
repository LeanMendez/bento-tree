/**
 * Parser mínimo de RSS 2.0 (y Atom) sin DOMParser: los Workers no lo tienen.
 * Solo extrae lo que la tile necesita (título, link, fecha).
 */
export interface FeedItem {
  title: string;
  link: string;
  /** Epoch ms; `null` si la fecha falta o no se puede parsear. */
  date: number | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Texto de un fragmento XML: CDATA literal, el resto con entidades decodificadas y espacios colapsados. */
function textOf(raw: string): string {
  const parts = raw.split(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const text = parts
    .map((part, index) => (index % 2 === 1 ? part : decodeEntities(part.replace(/<[^>]*>/g, ''))))
    .join('');
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Contenido del primer `<tag>` (con o sin atributos/prefijo) dentro de `xml`, o `null`. */
function tagContent(xml: string, tag: string): string | null {
  const name = escapeRegExp(tag);
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, 'i').exec(xml);
  return match ? (match[1] ?? '') : null;
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'gi');
  return Array.from(xml.matchAll(re), (match) => match[1] ?? '');
}

function parseDate(raw: string | null): number | null {
  if (raw === null) return null;
  const time = Date.parse(textOf(raw));
  return Number.isNaN(time) ? null : time;
}

function atomLink(entry: string): string {
  const links = Array.from(entry.matchAll(/<link\b([^>]*?)\/?>/gi), (match) => match[1] ?? '');
  const alternate = links.find(
    (attrs) => !/\brel\s*=/i.test(attrs) || /\brel\s*=\s*["']alternate["']/i.test(attrs),
  );
  const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(alternate ?? links[0] ?? '');
  return href ? decodeEntities(href[1] ?? href[2] ?? '').trim() : '';
}

/** Items del feed en el orden del documento. Ignora items sin título. */
export function parseFeed(xml: string): FeedItem[] {
  const rssItems = blocks(xml, 'item').map((item) => ({
    title: textOf(tagContent(item, 'title') ?? ''),
    link: textOf(tagContent(item, 'link') ?? ''),
    date: parseDate(tagContent(item, 'pubDate') ?? tagContent(item, 'dc:date')),
  }));
  const atomEntries = blocks(xml, 'entry').map((entry) => ({
    title: textOf(tagContent(entry, 'title') ?? ''),
    link: atomLink(entry),
    date: parseDate(tagContent(entry, 'published') ?? tagContent(entry, 'updated')),
  }));
  return [...rssItems, ...atomEntries].filter((item) => item.title !== '');
}

/**
 * Item más reciente por fecha (el feed no viene ordenado). Los items sin fecha válida van al final;
 * a igual fecha gana el primero del documento.
 */
export function latestItem(items: readonly FeedItem[]): FeedItem | null {
  let latest: FeedItem | null = null;
  for (const item of items) {
    if (latest === null || (item.date !== null && (latest.date === null || item.date > latest.date))) {
      latest = item;
    }
  }
  return latest;
}
