import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' }));
vi.mock('astro:env/server', () => env);

async function loadService() {
  vi.resetModules();
  return import('./twitch.service');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  env.TWITCH_CLIENT_ID = '';
  env.TWITCH_CLIENT_SECRET = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getLiveStatus', () => {
  it('devuelve null sin secrets y no llama a Twitch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { getLiveStatus } = await loadService();

    expect(await getLiveStatus('janedoe')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve null si Twitch falla', async () => {
    env.TWITCH_CLIENT_ID = 'id';
    env.TWITCH_CLIENT_SECRET = 'secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const { getLiveStatus } = await loadService();

    expect(await getLiveStatus('janedoe')).toBeNull();
  });

  it('devuelve el estado cuando Twitch responde', async () => {
    env.TWITCH_CLIENT_ID = 'id';
    env.TWITCH_CLIENT_SECRET = 'secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('oauth2/token')
          ? Response.json({ access_token: 'tok', expires_in: 3600 })
          : Response.json({ data: [] }),
      ),
    );
    const { getLiveStatus } = await loadService();

    expect(await getLiveStatus('janedoe')).toEqual({ live: false });
  });
});
