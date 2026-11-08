import { cached } from '../../lib/server/cache';
import { fetchOk, orNull } from '../../lib/server/http';
import { latestItem, parseFeed, type FeedItem } from './rss.parse';

const TTL_SECONDS = 60 * 60;

/** Último post del feed (por fecha) o `null` si el feed falla o está vacío. */
export function getLatestPost(rssUrl: string): Promise<FeedItem | null> {
  return cached(`blog:latest:${rssUrl}`, TTL_SECONDS, () =>
    orNull('blog', async () => {
      const response = await fetchOk(rssUrl, {
        headers: { accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' },
      });
      return latestItem(parseFeed(await response.text()));
    }),
  );
}
