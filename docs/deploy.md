# Deploy (Cloudflare Workers)

Plan gratuito: Workers + KV (`BENTO_KV`) + Cache API. Sin sesiones (`session: false`).

## Publicar

```sh
pnpm wrangler login   # una vez por máquina
pnpm deploy           # astro build && wrangler deploy
```

El build lee `.env` (página prerenderizada). Las server islands leen las mismas variables en runtime desde los secrets del Worker.

## Variables y secrets en producción

Todo valor personal va como **secret** del Worker (nunca en `wrangler.jsonc`). Cargar o actualizar todo de una vez desde `.env` + `.dev.vars`:

```sh
python3 - <<'EOF' > /tmp/bento-secrets.json
import json, re
d = {}
for f in ['.env', '.dev.vars']:
    for l in open(f):
        m = re.match(r'^([A-Z_]+)=(.*)$', l.strip())
        if m and m.group(2).strip('"'):
            d[m.group(1)] = m.group(2).strip('"')
print(json.dumps(d))
EOF
pnpm wrangler secret bulk /tmp/bento-secrets.json && shred -u /tmp/bento-secrets.json
```

Un valor suelto: `pnpm wrangler secret put NOMBRE`.

Si cambia un `PUBLIC_*`, hay que actualizar el secret **y** volver a hacer `pnpm deploy` (la página estática se genera en el build).

## KV

`BENTO_KV` ya existe; su id está en `wrangler.jsonc`. Solo lo escribe Spotify cuando cambia la playlist (límite free: 1.000 escrituras/día).

## Verificación rápida

```sh
curl https://<worker>.workers.dev/api/live   # {"live":false|true}; null = credenciales de Twitch mal
```
