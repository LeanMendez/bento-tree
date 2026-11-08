# Twitch: estado en vivo

La tile de Twitch muestra el pill **EN VIVO** y la nota "En vivo ahora · sumate" cuando el canal está transmitiendo. Sin credenciales (o si Twitch falla) la tile queda en estado offline, idéntica al diseño.

## Cómo funciona

- `GET /api/live` (no prerenderizado) consulta Helix `GET /helix/streams?user_login=$PUBLIC_TWITCH_LOGIN` con un **app access token** (client credentials) y responde `{ "live": true | false | null }` con `Cache-Control: public, max-age=60`. `null` = estado desconocido (sin secrets o error).
- El resultado se cachea 60 s en la Cache API de Cloudflare. El app token se guarda en memoria del Worker hasta su vencimiento (menos 5 min) y se renueva si Helix responde 401.
- En el navegador, `live-poller.ts` consulta `/api/live` al cargar y cada 60 s **solo con la pestaña visible**; al ocultarse pausa y al volver consulta enseguida.

## 1. Crear la app en Twitch

1. Entrar a <https://dev.twitch.tv/console/apps> con la cuenta de Twitch (requiere 2FA activado).
2. **Register Your Application**:
   - **Name**: cualquiera único (p. ej. `bento-tree-<algo>`).
   - **OAuth Redirect URLs**: `http://localhost` (el flujo client credentials no la usa, pero el formulario la exige).
   - **Category**: _Website Integration_.
   - **Client Type**: _Confidential_.
3. Guardar, abrir **Manage** y copiar el **Client ID**. Generar un **Client Secret** con **New Secret** y copiarlo (se muestra una sola vez).

No hace falta ningún scope ni autorizar al usuario: `streams` es un endpoint público que acepta app tokens.

## 2. Desarrollo local

Agregar a `.dev.vars` (runtime del Worker, en `.gitignore`):

```sh
TWITCH_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITCH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`PUBLIC_TWITCH_LOGIN` (el usuario del canal) va en `.env`. Probar:

```sh
pnpm astro dev
curl -s http://localhost:4321/api/live   # {"live":false} o {"live":true}
```

## 3. Producción

```sh
pnpm wrangler secret put TWITCH_CLIENT_ID
pnpm wrangler secret put TWITCH_CLIENT_SECRET
```

`PUBLIC_TWITCH_LOGIN` se configura como variable de build en Cloudflare Workers Builds.

## Probar el estado en vivo sin transmitir

Con `pnpm astro dev` corriendo, en la consola del navegador:

```js
const realFetch = window.fetch;
window.fetch = (url, init) =>
  String(url).endsWith('/api/live') ? Promise.resolve(Response.json({ live: true })) : realFetch(url, init);
```

El poller ya activo vuelve a consultar en el próximo tick (≤ 60 s) o enseguida al cambiar de pestaña y volver (la vuelta a `visible` consulta al instante). La tile muestra el pill y la nota en vivo; con `{ live: false }` vuelve al estado offline.
