import {
  PUBLIC_BLOG_RSS_URL,
  PUBLIC_BLOG_URL,
  PUBLIC_CALENDLY_URL,
  PUBLIC_GITHUB_FEATURED_REPO,
  PUBLIC_GITHUB_USER,
  PUBLIC_GUIDES_URL,
  PUBLIC_LINKEDIN_URL,
  PUBLIC_OWNER_EMAIL,
  PUBLIC_OWNER_NAME,
  PUBLIC_OWNER_ROLE,
  PUBLIC_PORTFOLIO_URL,
  PUBLIC_SPOTIFY_DEFAULT_PLAYLIST_URL,
  PUBLIC_TWITCH_LOGIN,
  PUBLIC_X_URL,
} from 'astro:env/server';

/** Categorías de los filtros del header. */
export type Category = 'code' | 'social' | 'content';

/** Último segmento no vacío del path de una URL (handle de LinkedIn/X). */
function lastPathSegment(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
}

/**
 * Contenido del sitio. Los datos personales vienen de variables de entorno (ver PLAN.md);
 * acá solo hay estructura y derivaciones.
 */
export const site = {
  owner: {
    name: PUBLIC_OWNER_NAME,
    role: PUBLIC_OWNER_ROLE,
    email: PUBLIC_OWNER_EMAIL,
  },
  github: {
    user: PUBLIC_GITHUB_USER,
    profileLabel: `github.com/${PUBLIC_GITHUB_USER}`,
    featured: {
      name: PUBLIC_GITHUB_FEATURED_REPO,
      url: `https://github.com/${PUBLIC_GITHUB_USER}/${PUBLIC_GITHUB_FEATURED_REPO}`,
      /** Fallback hasta que la integración (F2a) traiga los datos reales. */
      tags: ['Go', 'CLI'],
    },
  },
  twitch: {
    login: PUBLIC_TWITCH_LOGIN,
    url: `https://www.twitch.tv/${PUBLIC_TWITCH_LOGIN}`,
    label: `twitch.tv/${PUBLIC_TWITCH_LOGIN}`,
  },
  linkedin: { url: PUBLIC_LINKEDIN_URL, label: `/in/${lastPathSegment(PUBLIC_LINKEDIN_URL)}` },
  x: { url: PUBLIC_X_URL, label: `@${lastPathSegment(PUBLIC_X_URL)}` },
  portfolio: { url: PUBLIC_PORTFOLIO_URL, label: new URL(PUBLIC_PORTFOLIO_URL).host },
  blog: {
    url: PUBLIC_BLOG_URL,
    rssUrl: PUBLIC_BLOG_RSS_URL,
    /** Fallback hasta que la integración (F2b) lea el RSS. */
    fallbackLatestTitle: 'Aprendiendo Golang con proyectos',
  },
  guides: {
    /** Placeholder: sin URL la tile se muestra sin link. */
    url: PUBLIC_GUIDES_URL || null,
    count: 4,
    topics: ['React', 'Angular', 'Node', 'Claude Code'],
  },
  calendlyUrl: PUBLIC_CALENDLY_URL,
  spotify: { defaultPlaylistUrl: PUBLIC_SPOTIFY_DEFAULT_PLAYLIST_URL },
} as const;
