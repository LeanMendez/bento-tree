import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:env/server', () => ({ GITHUB_TOKEN: '' }));

import { fetchFeaturedRepo, getFeaturedRepo, mapRepo, type GithubRepo } from './github.service';

const repo: GithubRepo = {
  name: 'demo-repo',
  description: 'A demo repo',
  language: 'TypeScript',
  html_url: 'https://github.com/janedoe/demo-repo',
};

describe('mapRepo', () => {
  it('uses language and first topic, max 2 tags', () => {
    expect(mapRepo(repo, ['cli', 'ai', 'agents'])).toEqual({
      name: 'demo-repo',
      description: 'A demo repo',
      tags: ['TypeScript', 'cli'],
      url: 'https://github.com/janedoe/demo-repo',
    });
  });
  it('skips null language', () => {
    expect(mapRepo({ ...repo, language: null }, ['cli', 'ai', 'x']).tags).toEqual(['cli', 'ai']);
  });
  it('handles no topics', () => {
    expect(mapRepo(repo, []).tags).toEqual(['TypeScript']);
    expect(mapRepo({ ...repo, language: null }, []).tags).toEqual([]);
  });
  it('dedupes tags case-insensitively', () => {
    expect(mapRepo(repo, ['typescript', 'cli']).tags).toEqual(['TypeScript', 'cli']);
  });
  it('null or blank description → null (i18n fallback)', () => {
    expect(mapRepo({ ...repo, description: null }, []).description).toBeNull();
    expect(mapRepo({ ...repo, description: '  ' }, []).description).toBeNull();
  });
});

describe('fetching', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests repo and topics, auth only with token', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      Response.json(url.endsWith('/topics') ? { names: ['cli'] } : repo),
    );
    vi.stubGlobal('fetch', fetchMock);
    const data = await fetchFeaturedRepo('janedoe', 'demo-repo');
    expect(data.tags).toEqual(['TypeScript', 'cli']);
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
    await fetchFeaturedRepo('janedoe', 'demo-repo', 'tok');
    const authed = (fetchMock.mock.calls[2] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(authed.Authorization).toBe('Bearer tok');
  });

  it('returns null on HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 })),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await getFeaturedRepo('janedoe', 'missing')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await getFeaturedRepo('janedoe', 'demo-repo')).toBeNull();
  });
});
