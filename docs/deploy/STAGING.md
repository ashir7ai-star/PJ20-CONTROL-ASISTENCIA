# Despliegue en Easypanel — Staging

Guía paso a paso para publicar PJ20 en Easypanel con HTTPS. Sirve igual para producción (Fase 8) cambiando el nombre del proyecto, el dominio y los secretos.

> **Secretos:** las contraseñas se crean en Easypanel o en un gestor de contraseñas y solo se guardan en las variables de entorno de Easypanel. Nunca en el repositorio ni en el chat (`CLAUDE.md` §1.1).

## 0. Nombres

- Proyecto: `pj20-staging`
- Servicios: `postgres`, `redis`, `storage`, `api`, `app`
- Dentro de la red de Easypanel, cada servicio se alcanza como `pj20-staging_<servicio>` (ejemplo: `pj20-staging_postgres`).
- Dominio público: el que Easypanel asigna al servicio `app` (`https://pj20-staging-app.<id>.easypanel.host`). En esta guía se escribe `DOMINIO`.

## 1. Base de datos — servicio Postgres

**+ Service → Postgres**

| Campo         | Valor                                 |
| ------------- | ------------------------------------- |
| Service name  | `postgres`                            |
| Image         | `postgres:18-alpine`                  |
| Database name | `pj20`                                |
| User          | `pj20` (dueño: solo para migraciones) |
| Password      | la que genera Easypanel               |

**Sin puerto expuesto** («Expose» vacío).

## 2. Redis

**+ Service → Redis**: name `redis`, image `redis:8-alpine`, contraseña generada por Easypanel. **Sin puerto expuesto.**

## 3. Almacenamiento de fotos — RustFS

**+ Service → App**, name `storage`:

- Source: **Docker Image** `rustfs/rustfs:1.0.1`
- Environment:
  ```
  RUSTFS_ACCESS_KEY=<USUARIO_DE_RUSTFS>
  RUSTFS_SECRET_KEY=<SECRETO_DE_RUSTFS>
  RUSTFS_ADDRESS=:9000
  RUSTFS_CONSOLE_ENABLE=false
  ```
- `<USUARIO_DE_RUSTFS>`: aleatorio de 20+ caracteres; `<SECRETO_DE_RUSTFS>`: aleatorio de 40+ caracteres. La API usa los mismos dos valores (paso 4).
- Mounts: Volume → mount path `/data`
- **Sin dominio** y sin puerto expuesto.

## 4. API — servicio `api`

**+ Service → App**, name `api`:

- Source: **GitHub** · owner `ashir7ai-star` · repo `PJ20-CONTROL-ASISTENCIA` · branch `main` · build path `/`
- Build: **Dockerfile** · file `backend/Dockerfile`
- Environment:
  ```
  NODE_ENV=production
  LOG_LEVEL=info
  APP_ORIGINS=https://DOMINIO
  TRUST_PROXY=1
  GOOGLE_CLIENT_ID=1002299345818-efip0evqdnhnjg0a1inb950usltu9qlu.apps.googleusercontent.com
  DATABASE_MIGRATION_URL=postgres://pj20:<contraseña de postgres>@pj20-staging_postgres:5432/pj20
  DATABASE_URL=postgres://pj20_api:<contraseña nueva, 24+ caracteres>@pj20-staging_postgres:5432/pj20
  REDIS_URL=redis://default:<contraseña de redis>@pj20-staging_redis:6379
  S3_ENDPOINT=http://pj20-staging_storage:9000
  S3_REGION=us-east-1
  S3_BUCKET=pj20-selfies
  S3_ACCESS_KEY=<USUARIO_DE_RUSTFS>
  S3_SECRET_KEY=<SECRETO_DE_RUSTFS>
  ```
- Domain: `DOMINIO`, **path `/api`**, puerto interno `4400`, HTTPS activado.

`TRUST_PROXY=1` es el proxy de Easypanel (Traefik): la API registra la IP real del celular, no la del proxy.

## 5. App — servicio `app`

**+ Service → App**, name `app`:

- Source: GitHub, igual que `api`.
- Build: **Dockerfile** · file `app/Dockerfile`
- Environment (Easypanel lo pasa como argumento de compilación):
  ```
  VITE_GOOGLE_CLIENT_ID=1002299345818-efip0evqdnhnjg0a1inb950usltu9qlu.apps.googleusercontent.com
  ```
- Domain: `DOMINIO`, path `/`, puerto interno `8080`, HTTPS activado.

## 6. Preparar la base de datos (una vez, y en cada despliegue con migraciones nuevas)

En el servicio `api` → **Console** (o `docker exec` en el contenedor):

```sh
node dist/migrate.js                                   # crea o actualiza las tablas (dueño pj20)
node dist/db-usuario-app.js                            # crea/actualiza el usuario pj20_api con mínimos privilegios
node dist/admin-crear.js nathan@ylevigroup.com "Nathan"  # primer administrador
```

La API arranca aunque la base de datos aún no esté lista (`/api/health` lo informa) y se conecta en cuanto existe `pj20_api`; no hace falta reiniciarla.

`DATABASE_MIGRATION_URL` vive en el contenedor solo para estos comandos: el servidor nunca lo lee ni se conecta como dueño.

## 7. Google Cloud

Google Auth Platform → Clients → `PJ20 Control de Asistencia Web` → **Authorized JavaScript origins** → agregar `https://DOMINIO`. Esperar unos 5 minutos.

## 8. Verificación

- `https://DOMINIO/api/health` → `ok`.
- Desde fuera del VPS, los puertos de Postgres (5432), Redis (6379) y RustFS (9000) **no** responden.
- En el celular: iniciar sesión → consentimiento → Marcar → panel → cerrar sesión.
- Cabeceras: `Strict-Transport-Security` y `Content-Security-Policy` presentes; la cookie `__Host-pj20_sesion` es `Secure` y `HttpOnly`.

## 9. Redesplegar

Cada cambio fusionado en `main` se publica con **Deploy** en `api` y `app` (o activando **Auto Deploy** en ambos). Si hay migraciones nuevas, repetir el paso 6 (solo `migrate.js`).
