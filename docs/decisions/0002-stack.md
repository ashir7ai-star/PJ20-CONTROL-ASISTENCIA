# ADR 0002 — Stack técnico

- **Estado:** aceptada · 2026-10-05

## Decisión

| Capa             | Elección                                              | Motivo                                                                                |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Runtime          | Node.js 24 LTS                                        | LTS activa; misma versión local, CI y Docker (`.nvmrc`)                               |
| API              | Fastify 5 + TypeScript estricto                       | Rendimiento, tipado, ecosistema de seguridad (helmet, cors, rate-limit)               |
| Validación       | zod 4 (compartido)                                    | Un solo contrato para backend y app                                                   |
| Base de datos    | PostgreSQL 18                                         | Versión estable actual. **El servicio de Easypanel debe usar la misma versión mayor** |
| Caché / sesiones | Redis 8 (ioredis)                                     | Rate limiting y sesiones (Fase 2)                                                     |
| Almacenamiento   | **RustFS** (S3), cliente oficial AWS SDK v3           | Ver abajo                                                                             |
| Frontend         | React 19 + Vite 8 + Tailwind 4                        | Base de la PWA y del APK Capacitor                                                    |
| Pruebas          | Vitest (unitarias + integración con servicios reales) | Mismo motor en todo el monorepo                                                       |
| Servir la PWA    | nginx-unprivileged (no root)                          | CSP y cabeceras de seguridad, caché correcta                                          |

## Almacenamiento: RustFS en lugar de MinIO

El plan original decía MinIO. Al implementar se verificó que **MinIO dejó de publicar imágenes Docker de su edición comunitaria** (el repositorio `minio/minio` ya no existe en Docker Hub). Construir sobre una imagen sin mantenimiento contradice las reglas de seguridad.

Se eligió **RustFS 1.0** (Apache 2.0, compatible con S3, se ejecuta como usuario no root, publicado activamente). El backend usa el **SDK estándar de AWS S3**, por lo que el servidor de almacenamiento puede cambiarse (SeaweedFS, Garage, Cloudflare R2…) **sin tocar código**, solo variables de entorno.

## Rutas bajo `/api`

Todo el backend vive bajo `/api` (`/api/health`, `/api/v1/...`). En producción la app y la API comparten dominio: Easypanel enruta `/api` al backend y el resto a la PWA. Mismo origen = cookies de sesión `SameSite=Strict` sin CORS en producción. En desarrollo Vite replica esto con un proxy.
