# Despliegue en Easypanel — Staging

Guía paso a paso para publicar PJ20 en Easypanel con HTTPS, tal como se desplegó el 2026-10-08. Sirve igual para producción (Fase 8) cambiando el prefijo de los servicios, el dominio y los secretos.

> **Secretos:** las contraseñas se generan en Easypanel o en un archivo local ignorado por Git (`.env.staging`) y solo se guardan en las variables de entorno de Easypanel. Nunca en el repositorio, en capturas ni en el chat (`CLAUDE.md` §1.1). Si un secreto queda visible, se rota de inmediato (§6.3).

## 0. Nombres

- Proyecto de Easypanel: `ashir` (compartido con otros sistemas; por eso todo lleva el prefijo `pj20-asistencia-`).
- Servicios: `pj20-asistencia-postgres`, `pj20-asistencia-redis`, `pj20-asistencia-storage`, `pj20-asistencia-api`, `pj20-asistencia-app`.
- Dentro de la red de Easypanel cada servicio se alcanza como `<proyecto>_<servicio>` (ejemplo: `ashir_pj20-asistencia-postgres`).
- Dirección pública (`DOMINIO`): `pj20-asistencia.nr6aco.easypanel.host` (comodín `*.nr6aco.easypanel.host` de Easypanel, HTTPS automático).

## 1. Base de datos — Postgres

**+ → Postgres**

| Campo         | Valor                                  |
| ------------- | -------------------------------------- |
| Service Name  | `pj20-asistencia-postgres`             |
| Database Name | `pj20`                                 |
| User          | `pj20` (dueño: solo para migraciones)  |
| Password      | vacío → Easypanel genera una aleatoria |
| Docker Image  | `postgres:18-alpine`                   |

**Advanced → Environment Variables:** `PGDATA=/var/lib/postgresql/data`. Postgres 18 cambió su carpeta de datos y Easypanel monta el disco en la antigua; sin esta variable el contenedor no arranca.

Sin puerto expuesto.

## 2. Redis

**+ → Redis**: Service Name `pj20-asistencia-redis`, Password vacío (aleatoria), Docker Image `redis:8-alpine`. Sin puerto expuesto.

## 3. Almacenamiento de fotos — RustFS

**+ → App**, Service Name `pj20-asistencia-storage`:

- Source: pestaña **Docker Image** → `rustfs/rustfs:1.0.1`.
- Environment:
  ```
  RUSTFS_ACCESS_KEY=<USUARIO_DE_RUSTFS>
  RUSTFS_SECRET_KEY=<SECRETO_DE_RUSTFS>
  RUSTFS_ADDRESS=:9000
  RUSTFS_CONSOLE_ENABLE=false
  ```
- `<USUARIO_DE_RUSTFS>`: aleatorio de 20+ caracteres; `<SECRETO_DE_RUSTFS>`: aleatorio de 40+ caracteres. La API usa los mismos dos valores (paso 4).
- **Storage → Add Volume**: name `data`, mount path `/data`.
- **Sin dominio** (borrar el que Easypanel cree automáticamente, si lo hay) y sin puerto expuesto.

## 4. API — `pj20-asistencia-api`

**+ → App**, Service Name `pj20-asistencia-api`:

- **Source → Github**: Repository `ashir7ai-star/PJ20-CONTROL-ASISTENCIA` (con el dueño), Branch `main`, Build Path `/`.
- **Build** (más abajo en la misma página): **Dockerfile**, campo **File** `backend/Dockerfile`. (No usar la pestaña «Dockerfile» de Source: esa es para pegar el contenido.)
- Environment:
  ```
  NODE_ENV=production
  LOG_LEVEL=info
  APP_ORIGINS=https://DOMINIO
  TRUST_PROXY=1
  GOOGLE_CLIENT_ID=1002299345818-efip0evqdnhnjg0a1inb950usltu9qlu.apps.googleusercontent.com
  DATABASE_MIGRATION_URL=postgres://pj20:<PASSWORD_POSTGRES>@ashir_pj20-asistencia-postgres:5432/pj20
  DATABASE_URL=postgres://pj20_api:<PASSWORD_API>@ashir_pj20-asistencia-postgres:5432/pj20
  REDIS_URL=redis://default:<PASSWORD_REDIS>@ashir_pj20-asistencia-redis:6379
  S3_ENDPOINT=http://ashir_pj20-asistencia-storage:9000
  S3_REGION=us-east-1
  S3_BUCKET=pj20-selfies
  S3_ACCESS_KEY=<USUARIO_DE_RUSTFS>
  S3_SECRET_KEY=<SECRETO_DE_RUSTFS>
  ```
  `<PASSWORD_API>`: aleatoria de 24+ caracteres (la crea `db-usuario-app.js`, paso 6). Si una contraseña tiene símbolos (`@ : / ? #`), va codificada para URL.
- **Domains**: borrar el dominio automático (`ashir-pj20-asistencia-api…`). Agregar: HTTPS, Host `DOMINIO`, Path `/api` → Destination HTTP, Port **`80`**, Path `/api`.
  - Easypanel le asigna a la app el puerto 80 (variable `PORT`), por eso el destino es 80 y no 4400.
  - El Path de destino debe ser `/api`: así la API recibe `/api/v1/…` completo.

`TRUST_PROXY=1` es el proxy de Easypanel (Traefik): la API registra la IP real del celular, no la del proxy.

## 5. App — `pj20-asistencia-app`

**+ → App**, Service Name `pj20-asistencia-app`:

- Source y Build: igual que la API, con File `app/Dockerfile`.
- Environment (Easypanel lo pasa como argumentos de compilación; no son secretos):
  ```
  VITE_GOOGLE_CLIENT_ID=1002299345818-efip0evqdnhnjg0a1inb950usltu9qlu.apps.googleusercontent.com
  VITE_PUBLIC_URL=https://DOMINIO
  ```
  `VITE_PUBLIC_URL` activa la vista previa con el logo al compartir el enlace (WhatsApp, Telegram…).
- **Domains**: borrar el automático. Agregar: HTTPS, Host `DOMINIO`, Path `/` → Destination HTTP, Port **`8080`**, Path `/` (la app la sirve nginx en 8080).

## 6. Preparar la base de datos (una vez, y en cada despliegue con migraciones nuevas)

En `pj20-asistencia-api` → ícono **`>_`** (Console) → **Sh**:

```sh
node dist/migrate.js                                     # crea o actualiza las tablas (dueño pj20)
node dist/db-usuario-app.js                              # crea/actualiza el usuario pj20_api con mínimos privilegios
node dist/admin-crear.js nathan@ylevigroup.com "Nathan"  # primer administrador
```

La API arranca aunque la base de datos aún no esté lista (`/api/health` lo informa) y se conecta en cuanto existe `pj20_api`; no hace falta reiniciarla.

`DATABASE_MIGRATION_URL` vive en el contenedor solo para estos comandos: el servidor nunca lo lee ni se conecta como dueño.

## 7. Google Cloud

Google Auth Platform → Clients → `PJ20 Control de Asistencia Web` → **Authorized JavaScript origins** → agregar `https://DOMINIO`. Esperar unos 5 minutos.

## 8. Verificación

- `https://DOMINIO/api/health` → `{"status":"ok", …}` con `database`, `cache` y `storage` en `up`.
- Desde fuera del VPS, los puertos 5432, 6379 y 9000 **no** responden.
- Los dominios automáticos de Easypanel (`ashir-pj20-asistencia-…`) responden 404.
- Cabeceras: `Strict-Transport-Security` y `Content-Security-Policy` presentes; la cookie `__Host-pj20_sesion` es `Secure` y `HttpOnly`.
- En el celular: iniciar sesión → consentimiento → Marcar → panel → cerrar sesión.

## 9. Redesplegar

Cada cambio fusionado en `main` se publica con **Deploy** en `pj20-asistencia-api` y `pj20-asistencia-app` (o activando **Auto Deploy**). Si hay migraciones nuevas, repetir solo `node dist/migrate.js` (paso 6).
