# Fase 0 — Fundaciones · Plan detallado

> Estado: **pendiente de aprobación** · 2026-10-05
> Repositorio: https://github.com/ashir7ai-star/PJ20-CONTROL-ASISTENCIA (privado, vacío)

## 1. Objetivo

Dejar lista la base técnica sobre la que se construirá todo el proyecto: estructura del repositorio, entorno local con Docker, calidad automática (lint, tipos, pruebas) y CI en GitHub. **No incluye** pantallas reales (Fase 1), esquema de base de datos ni login (Fase 2).

## 2. Diagnóstico del equipo (verificado el 2026-10-05)

| Elemento | Estado | Acción |
|---|---|---|
| Node.js 24.15 / npm 11.12 | OK | — |
| Git 2.53 | OK, pero **sin nombre ni correo configurados** | Configurarlos (ver §8) |
| Docker 29.4 + Compose 5.1 | OK, Docker Desktop corriendo | — |
| pnpm | No instalado (Corepack 0.34 sí) | Activar con Corepack, sin instalaciones globales extra |
| GitHub CLI (`gh`) | No instalado | No es necesario; se usa la web de GitHub para los Pull Requests |
| Puertos 5432, 6379, 3000 | **Ocupados** por otros servicios | Usar puertos alternos (ver §4) para no interferir con tus otros proyectos |

## 3. Decisiones técnicas

| Decisión | Elección | Motivo |
|---|---|---|
| Gestor de paquetes | **pnpm workspaces** | Estándar en monorepos profesionales; rápido, estricto con dependencias |
| Backend | Fastify + TypeScript | Rápido, tipado, validación por esquemas nativa |
| Validación | zod (compartido backend ↔ app) | Un solo contrato de datos para ambos lados |
| Frontend | React + Vite + TypeScript + Tailwind | Base para la PWA y para Capacitor |
| Pruebas | Vitest | Mismo motor en backend y frontend |
| Calidad | ESLint + Prettier + TypeScript strict | Regla §4 de `CLAUDE.md` |
| Servicios locales | PostgreSQL 17, Redis, MinIO en Docker | Igual que en Easypanel |
| Versiones | Última estable de cada herramienta, verificada al instalar | Evitar dependencias obsoletas |

Cada decisión se documenta como ADR en `docs/decisions/`.

## 4. Estructura y puertos

```
pj20-control-asistencia/
├─ CLAUDE.md · README.md · .gitignore · .gitattributes · .editorconfig · .nvmrc
├─ package.json · pnpm-workspace.yaml · tsconfig.base.json · eslint.config.js · .prettierrc
├─ docker-compose.yml        Postgres, Redis, MinIO (solo accesibles desde tu PC)
├─ .env.example              Variables documentadas, sin valores reales
├─ backend/                  API Fastify: config validada, logs, /health, Dockerfile
├─ app/                      React + Vite: página mínima, Dockerfile
├─ packages/shared/          Esquemas y tipos compartidos
├─ docs/  PLAN.md · phases/ · decisions/
└─ .github/  workflows/ci.yml · dependabot.yml
```

| Servicio | Puerto en tu PC | Nota |
|---|---|---|
| Postgres | 55432 | 5432 está ocupado |
| Redis | 56379 | 6379 está ocupado |
| MinIO API / consola | 59000 / 59001 | |
| Backend | 4000 | 3000 está ocupado |
| App (Vite) | 5173 | Coincide con el origen OAuth de Google |

Todos los puertos se publican **solo en `127.0.0.1`**: nadie en tu red puede conectarse a la base de datos.

## 5. Pasos de implementación

1. **Git:** inicializar repositorio, rama `main`, `.gitignore` (bloquea `.env`, llaves, `.keystore`, dumps), `.gitattributes` (finales de línea LF para evitar problemas Windows/Linux).
2. **Commit inicial en `main`** solo con `CLAUDE.md`, `docs/` y archivos de configuración de Git. Es la única excepción a "nunca push directo a `main`", porque el repositorio está vacío.
3. Crear rama `feat/fase-0-fundaciones`; todo lo demás va por Pull Request.
4. Monorepo pnpm + configuración compartida de TypeScript, ESLint y Prettier.
5. `packages/shared`: paquete mínimo con un esquema de ejemplo y su prueba.
6. `backend`: servidor Fastify con configuración validada al arrancar (si falta una variable, no inicia), logs JSON con ID de petición, cabeceras de seguridad, formato de error único y `GET /health` que verifica Postgres, Redis y MinIO. Pruebas del endpoint.
7. `app`: proyecto Vite + React + Tailwind con una página mínima que consulta `/health` (el diseño real llega en la Fase 1). Prueba básica.
8. `docker-compose.yml` con healthchecks y volúmenes persistentes; Redis y MinIO con contraseña.
9. Dockerfiles multi-stage con usuario no root para `backend` y `app`.
10. CI en GitHub Actions: instalar → lint → typecheck → pruebas (con Postgres y Redis reales) → build → construir imágenes Docker → **escaneo de secretos** (gitleaks).
11. Dependabot para actualizaciones de seguridad.
12. `README.md` con cómo levantar el proyecto en 3 comandos.
13. ADRs: monorepo/pnpm, stack, PWA + APK Capacitor.

## 6. Criterios de aceptación

- [ ] `pnpm install` y `docker compose up -d` dejan todos los servicios en estado *healthy*.
- [ ] `pnpm dev` levanta backend (4000) y app (5173); la app muestra el estado de `/health`.
- [ ] `GET /health` responde 200 con los tres servicios OK, y 503 si uno cae (probado deteniendo Redis).
- [ ] El backend se niega a arrancar si falta una variable de entorno obligatoria.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan sin errores ni advertencias.
- [ ] Ambas imágenes Docker se construyen y corren como usuario no root.
- [ ] CI en verde en el Pull Request en GitHub.
- [ ] Ningún secreto en el repositorio (gitleaks limpio).

## 7. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Choque con servicios que ya usas en 5432/6379/3000 | Puertos alternos (§4); no se toca nada existente |
| Problemas de finales de línea Windows ↔ Linux (Docker, CI) | `.gitattributes` con LF + `.editorconfig` |
| Subir un secreto por error | `.gitignore` estricto + gitleaks en CI |
| Diferencias entre tu PC y CI | Versión de Node fijada (`.nvmrc`) y lockfile versionado |

**Reversión:** todo es nuevo; no se modifica nada existente. Si algo sale mal, se descarta la rama.

## 8. Lo que necesito de ti

1. **Aprobar este plan** (y el plan maestro).
2. Indicarme el **nombre y correo para los commits** (ej. tu nombre y el correo de tu cuenta de GitHub), para configurarlos solo en este repositorio.
3. Cuando yo te avise: hacer el primer `git push`. Si tu PC aún no tiene credenciales de GitHub, Git abrirá el navegador para iniciar sesión (una sola vez).
