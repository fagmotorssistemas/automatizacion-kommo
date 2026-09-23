# Deploy: DigitalOcean + Cloudflare (`bot.ksinuevos.com`)

Cómo quedó levantado el backend Nest en el droplet `n8n-fagmotors` y cómo se conectó el subdominio en Cloudflare.

**No tocar:** n8n (Docker en `/root`), `backend-autos` (PM2, puerto 3000), ni `/root/docker-compose.yml`.

---

## Cómo está armado

```
Internet
   │
   │  DNS A (Cloudflare, nube gris / Solo DNS)
   │  bot.ksinuevos.com → 138.197.35.10
   ▼
Droplet DigitalOcean  n8n-fagmotors
   │
   ├── nginx :80 / :443  (site bot.ksinuevos.com + Let's Encrypt)
   │         proxy_pass → 127.0.0.1:3001
   │
   ├── PM2  nest-kommo  →  /opt/automatizacion-kommo/dist/main.js
   │
   ├── PM2  backend-autos  →  :3000   (otro proyecto, no mezclar)
   └── Docker n8n          →  :5678   (sigue recibiendo Kommo)
```

| Pieza | Valor |
|--------|--------|
| Droplet | `n8n-fagmotors` |
| IP pública | `138.197.35.10` |
| Código | `/opt/automatizacion-kommo` |
| Proceso PM2 | `nest-kommo` |
| Puerto app | `3001` (`PORT=3001` en `.env`) |
| Dominio | `https://bot.ksinuevos.com` |
| Health | `https://bot.ksinuevos.com/health` |
| Webhook | `https://bot.ksinuevos.com/webhooks/kommo` |
| Shadow | `SHADOW_MODE=true` (no envía WhatsApp; n8n sigue enviando) |
| Repo | `https://github.com/fagmotorssistemas/automatizacion-kommo` |

El DNS **no** se crea en el CLI de DigitalOcean. `ksinuevos.com` usa nameservers de Cloudflare (`huxley.ns.cloudflare.com` / `serenity.ns.cloudflare.com`). DigitalOcean solo hospeda el proceso y nginx.

---

## 1. Cloudflare (DNS)

Panel: sitio **ksinuevos.com** → **DNS** → **Registros**.

No es Dominios → Registros (eso es WHOIS / renovación del dominio).

URL típica:

`https://dash.cloudflare.com/<account>/ksinuevos.com/dns/records`

Registro creado:

| Campo | Valor |
|--------|--------|
| Tipo | `A` |
| Nombre | `bot` |
| IPv4 | `138.197.35.10` |
| Proxy | **Solo DNS** (nube gris) |
| TTL | Automático |

`n8n.ksinuevos.com` es un **túnel** de Cloudflare. `bot` no: apunta directo a la IP del droplet.

Comprobar desde el droplet:

```bash
dig NS ksinuevos.com +short
dig +short bot.ksinuevos.com
```

Debe salir:

```
huxley.ns.cloudflare.com.
serenity.ns.cloudflare.com.
```

y

```
138.197.35.10
```

---

## 2. Servidor: código y proceso

Hecho una vez en el droplet (SSH como `root`):

```bash
cd /opt
git clone https://github.com/fagmotorssistemas/automatizacion-kommo.git
cd /opt/automatizacion-kommo
```

`.env` en el servidor (no está en git). Copiar variables locales y forzar:

```
PORT=3001
SHADOW_MODE=true
```

`SUPABASE_SERVICE_ROLE_KEY` debe ser la key **service_role**, no la anon.

Instalar, compilar y arrancar:

```bash
cd /opt/automatizacion-kommo
npm ci
npm run build
pm2 start /opt/automatizacion-kommo/dist/main.js --name nest-kommo
pm2 save

cd /opt/automatizacion-kommo
git pull
npm run build
pm2 restart nest-kommo --update-env
pm2 logs nest-kommo
```

PM2 queda persistido en `/root/.pm2/dump.pm2`. Tras reboot del droplet, `nest-kommo` debe volver solo si el startup de PM2 ya estaba habilitado (`pm2 startup`).

Node del droplet: **v20**. Supabase 2.116 pide WebSocket nativo (Node 22). El repo ya incluye el polyfill `ws` en `src/modules/persistence/supabase.client.ts`. Sin eso, PM2 se ve `online` pero crashea en loop y el puerto 3001 no abre.

---

## 3. Nginx + HTTPS

```bash
cat > /etc/nginx/sites-available/bot.ksinuevos.com <<'EOF'
server {
    listen 80;
    server_name bot.ksinuevos.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bot.ksinuevos.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d bot.ksinuevos.com
```

Certificado: `/etc/letsencrypt/live/bot.ksinuevos.com/`. Certbot renueva solo.

El site de `capi.lavilett.com` y n8n no se tocan: este `server_name` es solo `bot.ksinuevos.com`.

---

## 4. Qué revisar en DigitalOcean (día a día)

En la consola del droplet (`root@n8n-fagmotors`):

```bash
# Proceso
pm2 ls
pm2 show nest-kommo

# Health local y público
curl -s http://127.0.0.1:3001/health
curl -s https://bot.ksinuevos.com/health

# ¿Escucha el puerto?
ss -lntp | grep -E '3001|3000|443|80'

# DNS
dig +short bot.ksinuevos.com

# Nginx
ls /etc/nginx/sites-enabled
nginx -t

# Logs de Nest
pm2 logs nest-kommo --lines 50 --nostream

# Puerto y shadow del .env (sin imprimir secretos)
grep -E '^(PORT|SHADOW_MODE)=' /opt/automatizacion-kommo/.env
```

Respuestas sanas:

- `pm2 ls`: `nest-kommo` **online**, `↺` estable (no subiendo cada 2 s).
- Health: `{"status":"ok","service":"ksi-fagmotors-backend"}`
- `ss`: node en `127.0.0.1:3001` o `*:3001`, nginx en 80/443.
- `dig`: `138.197.35.10`

Si `pm2` dice online pero `curl` a 3001 da *connection refused*, mira errores:

```bash
pm2 logs nest-kommo --err --lines 80 --nostream
```

---

## 5. Actualizar código

En el PC: `git push` de este repo.

En el droplet:

```bash
cd /opt/automatizacion-kommo
git pull
npm ci
npm run build
pm2 restart nest-kommo --update-env
sleep 3
curl -s https://bot.ksinuevos.com/health
```

`--update-env` solo si cambiaste variables de entorno en PM2. El `.env` del directorio lo lee Nest al arrancar.

---

## 6. Webhook (aún no en Kommo)

Kommo **sigue** apuntando a n8n. Con `SHADOW_MODE=true`, Nest no manda WhatsApp.

URL de prueba (copia desde n8n, HTTP Request POST):

`https://bot.ksinuevos.com/webhooks/kommo`

Pasar a Kommo solo cuando `SHADOW_MODE=false` y las respuestas estén validadas en logs / `automation_run_logs`.
