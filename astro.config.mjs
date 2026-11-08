// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const publicString = (/** @type {{ optional?: boolean }} */ opts = {}) =>
  envField.string({ context: 'server', access: 'public', ...opts });
const publicUrl = (/** @type {{ optional?: boolean }} */ opts = {}) =>
  envField.string({ context: 'server', access: 'public', url: true, ...opts });
const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

// https://astro.build/config
export default defineConfig({
  // Sin imágenes rasterizadas en el diseño: evita provisionar el binding IMAGES.
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Sin sesiones: evita que el adapter provisione un KV SESSION que no usamos.
  session: false,
  // La barra de dev se superpone a la página y rompe la comparación pixel perfect.
  devToolbar: { enabled: false },
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      // Datos personales: nunca en el repo (ver PLAN.md §2 "Datos personales y secrets").
      PUBLIC_OWNER_NAME: publicString(),
      PUBLIC_OWNER_INITIALS: publicString(),
      PUBLIC_OWNER_ROLE: publicString(),
      PUBLIC_OWNER_EMAIL: envField.string({ context: 'server', access: 'public', includes: '@' }),
      PUBLIC_GITHUB_USER: publicString(),
      PUBLIC_GITHUB_FEATURED_REPO: publicString(),
      PUBLIC_TWITCH_LOGIN: publicString(),
      PUBLIC_LINKEDIN_URL: publicUrl(),
      PUBLIC_X_URL: publicUrl(),
      PUBLIC_PORTFOLIO_URL: publicUrl(),
      PUBLIC_BLOG_URL: publicUrl(),
      PUBLIC_BLOG_RSS_URL: publicUrl(),
      PUBLIC_GUIDES_URL: publicUrl({ optional: true }),
      PUBLIC_CALENDLY_URL: publicUrl(),
      PUBLIC_SPOTIFY_DEFAULT_PLAYLIST_URL: publicUrl(),

      SPOTIFY_CLIENT_ID: secret(),
      SPOTIFY_CLIENT_SECRET: secret(),
      SPOTIFY_REFRESH_TOKEN: secret(),
      TWITCH_CLIENT_ID: secret(),
      TWITCH_CLIENT_SECRET: secret(),
      GITHUB_TOKEN: secret(),
    },
  },
});
