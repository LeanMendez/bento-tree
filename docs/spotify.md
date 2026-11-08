# Integración con Spotify

El footer muestra la playlist propia que estás escuchando (o la última propia que escuchaste). Sin credenciales, o si Spotify no devuelve nada, se muestra el texto del diseño ("Mi playlist en Spotify") con `PUBLIC_SPOTIFY_DEFAULT_PLAYLIST_URL`.

Cadena de resolución (`src/features/spotify/spotify.service.ts`):

1. `GET /v1/me/player/currently-playing`: si suena una playlist cuyo dueño sos vos, esa.
2. Si no: `GET /v1/me/player/recently-played?limit=50`, la más reciente con contexto de playlist propia.
3. Si no: la última guardada en KV (`BENTO_KV`, clave `spotify:last-playlist`). Solo se escribe cuando cambia el id (límite free de 1.000 escrituras/día).
4. Si no: fallback del diseño.

El resultado se cachea 2 min; el access token, 55 min.

## 1. Crear la app en Spotify

Requisito: la cuenta dueña de la app debe ser **Premium** (obligatorio para apps en Development Mode).

1. Entrá a <https://developer.spotify.com/dashboard> con tu cuenta y tocá **Create app**.
2. Completá nombre y descripción (cualquiera).
3. En **Redirect URIs** agregá exactamente `http://127.0.0.1:8888/callback` (Spotify exige IP de loopback, no `localhost`).
4. En **Which API/SDKs are you planning to use?** marcá **Web API**.
5. Aceptá los términos y guardá.
6. En **Settings** copiá el **Client ID** y el **Client secret** (botón _View client secret_).

## 2. Obtener el refresh token

1. Creá `.dev.vars` en la raíz (está en `.gitignore`) con:

   ```
   SPOTIFY_CLIENT_ID=<client id>
   SPOTIFY_CLIENT_SECRET=<client secret>
   ```

2. Ejecutá:

   ```sh
   pnpm spotify:auth
   ```

   El script levanta un servidor en `http://127.0.0.1:8888/callback`, abre el navegador con la pantalla de autorización (si no se abre, copiá la URL que imprime) y pide los scopes `user-read-currently-playing user-read-recently-played user-read-playback-state playlist-read-private`.

3. Aceptá. La terminal imprime el **refresh token**.

## 3. Configurar los secrets

### Local (`pnpm dev`)

Agregá el token a `.dev.vars`:

```
SPOTIFY_CLIENT_ID=<client id>
SPOTIFY_CLIENT_SECRET=<client secret>
SPOTIFY_REFRESH_TOKEN=<refresh token>
```

Reiniciá el dev server. El KV `BENTO_KV` se simula localmente.

### Producción (Cloudflare)

```sh
pnpm wrangler secret put SPOTIFY_CLIENT_ID
pnpm wrangler secret put SPOTIFY_CLIENT_SECRET
pnpm wrangler secret put SPOTIFY_REFRESH_TOKEN
```

Cada comando pide el valor por consola. El namespace `BENTO_KV` se provisiona en el deploy (F3).

## Problemas comunes

- **Siempre se ve el fallback**: revisá los logs del worker (`[spotify]`). Un `HTTP 400` en `/api/token` suele ser un refresh token revocado: repetí el paso 2.
- **`INVALID_CLIENT: Invalid redirect URI`**: la Redirect URI del dashboard no coincide exactamente con `http://127.0.0.1:8888/callback`.
- **No aparece una playlist que escuchás**: solo cuentan las playlists cuyo dueño sos vos; las editoriales o de terceros se ignoran.
