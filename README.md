# PJ20 · Control de Asistencia

Registro de entradas y salidas de empleados con **hora del servidor, ubicación GPS y selfie**, con protección contra ubicaciones falsas. Los empleados inician sesión con Google; los administradores gestionan todo desde un panel.

> Reglas del proyecto: [`CLAUDE.md`](CLAUDE.md) · Plan: [`docs/PLAN.md`](docs/PLAN.md) · Decisiones: [`docs/decisions/`](docs/decisions/)

## Requisitos

- Node.js 24 (`.nvmrc`)
- pnpm vía Corepack: `corepack enable` (si no hay permisos de administrador: `corepack enable --install-directory "%APPDATA%\npm" pnpm`)
- Docker Desktop

## Inicio rápido

```bash
cp .env.example .env        # y reemplaza todos los valores "change-me"
docker compose up -d --wait # Postgres, Redis y almacenamiento S3 (RustFS)
pnpm install && pnpm dev    # API en :4400 y app en http://localhost:5173
```

## Estructura

| Carpeta            | Contenido                                                 |
| ------------------ | --------------------------------------------------------- |
| `backend/`         | API Fastify (todas las rutas bajo `/api`)                 |
| `app/`             | App React (PWA; APK Android con Capacitor en la Fase 5)   |
| `packages/shared/` | Contratos y tipos compartidos (zod)                       |
| `docs/`            | Plan maestro, planes por fase y decisiones técnicas (ADR) |

## Puertos locales

Todos publicados solo en `127.0.0.1`. Están fuera del rango dinámico de Windows (49152–65535), que Hyper-V reserva al azar en cada reinicio.

| Servicio                    | Puerto        |
| --------------------------- | ------------- |
| App (Vite)                  | 5173          |
| API                         | 4400          |
| PostgreSQL                  | 15432         |
| Redis                       | 16379         |
| Almacenamiento S3 / consola | 19000 / 19001 |

## Comandos

| Comando                 | Qué hace                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`              | Levanta API y app con recarga automática                               |
| `pnpm check`            | Formato + lint + tipos + pruebas + build (lo mismo que el CI)          |
| `pnpm test`             | Pruebas unitarias                                                      |
| `pnpm test:integration` | Pruebas contra Postgres/Redis/S3 reales (requiere `docker compose up`) |
| `pnpm format`           | Formatea el código                                                     |

## Flujo de trabajo

1. Rama desde `main`: `feat/...` o `fix/...`.
2. `pnpm check` en verde antes de subir.
3. Pull Request → el CI debe pasar (calidad, integración, imágenes Docker, escaneo de secretos).
4. Nunca push directo a `main`.
