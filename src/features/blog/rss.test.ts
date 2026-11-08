import { afterEach, describe, expect, it, vi } from 'vitest';
import { latestItem, parseFeed } from './rss.parse';
import { getLatestPost } from './rss.service';

const RSS_URL = 'https://blog.example.com/rss.xml';

/** Fixture con datos ficticios que reproduce el feed real: sin ordenar, el más nuevo en 4.º lugar. */
const UNSORTED_FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<title>Jane Doe Blog</title><link>https://blog.example.com/</link>
<item><title>Re-renders en React</title><link>https://blog.example.com/posts/re-renders/</link><pubDate>Thu, 26 Sep 2024 00:00:00 GMT</pubDate></item>
<item><title>React &amp; hooks &lt;3 &#39;básico&#39; &#x2014; guía</title><link>https://blog.example.com/posts/hooks/</link><pubDate>Sun, 22 Sep 2024 00:00:00 GMT</pubDate></item>
<item>
  <title>   Sin fecha   </title>
  <link>https://blog.example.com/posts/sin-fecha/</link>
</item>
<item>
  <title><![CDATA[Aprendiendo Go con proyectos & <tests>]]></title>
  <link><![CDATA[https://blog.example.com/posts/go/]]></link>
  <guid isPermaLink="true">https://blog.example.com/posts/go/</guid>
  <pubDate>
    Mon, 14 Oct 2024 00:00:00 GMT
  </pubDate>
</item>
<item><title>Fecha rota</title><link>https://blog.example.com/posts/rota/</link><pubDate>not a date</pubDate></item>
</channel></rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>Jane Doe</title>
<entry><title type="html">Viejo</title><link rel="alternate" href="https://example.com/old"/><updated>2023-01-01T00:00:00Z</updated></entry>
<entry><title>Nuevo &amp; mejor</title><link rel="self" href="https://example.com/self.xml"/><link href="https://example.com/new"/><published>2024-05-01T10:00:00Z</published></entry>
</feed>`;

const EMPTY_FEED = '<?xml version="1.0"?><rss version="2.0"><channel><title>Vacío</title></channel></rss>';

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseFeed', () => {
  it('extrae título, link y fecha en el orden del documento', () => {
    const items = parseFeed(UNSORTED_FEED);
    expect(items.map((item) => item.title)).toEqual([
      'Re-renders en React',
      "React & hooks <3 'básico' — guía",
      'Sin fecha',
      'Aprendiendo Go con proyectos & <tests>',
      'Fecha rota',
    ]);
    expect(items[3]).toEqual({
      title: 'Aprendiendo Go con proyectos & <tests>',
      link: 'https://blog.example.com/posts/go/',
      date: Date.UTC(2024, 9, 14),
    });
  });

  it('marca como null las fechas ausentes o inválidas', () => {
    const items = parseFeed(UNSORTED_FEED);
    expect(items[2]?.date).toBeNull();
    expect(items[4]?.date).toBeNull();
  });

  it('tolera Atom: <entry>, link alternate y published/updated', () => {
    expect(parseFeed(ATOM_FEED)).toEqual([
      { title: 'Viejo', link: 'https://example.com/old', date: Date.UTC(2023, 0, 1) },
      { title: 'Nuevo & mejor', link: 'https://example.com/new', date: Date.UTC(2024, 4, 1, 10) },
    ]);
  });

  it('devuelve [] para un feed vacío o basura', () => {
    expect(parseFeed(EMPTY_FEED)).toEqual([]);
    expect(parseFeed('<html>no es un feed</html>')).toEqual([]);
  });
});

describe('latestItem', () => {
  it('elige el más nuevo por fecha aunque el feed no esté ordenado', () => {
    expect(latestItem(parseFeed(UNSORTED_FEED))?.title).toBe('Aprendiendo Go con proyectos & <tests>');
  });

  it('manda los items sin fecha al final', () => {
    const items = [
      { title: 'sin fecha', link: '', date: null },
      { title: 'con fecha', link: '', date: 1 },
    ];
    expect(latestItem(items)?.title).toBe('con fecha');
  });

  it('si ninguno tiene fecha, usa el primero del documento', () => {
    const items = [
      { title: 'a', link: '', date: null },
      { title: 'b', link: '', date: null },
    ];
    expect(latestItem(items)?.title).toBe('a');
  });

  it('devuelve null sin items', () => {
    expect(latestItem([])).toBeNull();
  });
});

describe('getLatestPost', () => {
  it('descarga el feed y devuelve el post más reciente', async () => {
    const fetchMock = stubFetch(new Response(UNSORTED_FEED, { status: 200 }));
    const post = await getLatestPost(RSS_URL);
    expect(post?.title).toBe('Aprendiendo Go con proyectos & <tests>');
    expect(fetchMock).toHaveBeenCalledWith(RSS_URL, expect.any(Object));
  });

  it('devuelve null con un feed vacío', async () => {
    stubFetch(new Response(EMPTY_FEED, { status: 200 }));
    expect(await getLatestPost(RSS_URL)).toBeNull();
  });

  it('devuelve null si el feed responde con error HTTP', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(new Response('boom', { status: 503 }));
    expect(await getLatestPost(RSS_URL)).toBeNull();
  });

  it('devuelve null si la red falla', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(new TypeError('network down'));
    expect(await getLatestPost(RSS_URL)).toBeNull();
  });
});
