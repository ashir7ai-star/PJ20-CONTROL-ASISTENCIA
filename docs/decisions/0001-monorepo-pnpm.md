# ADR 0001 — Monorepo con pnpm workspaces

- **Estado:** aceptada · 2026-10-05

## Contexto

El proyecto tiene backend, app (PWA + APK) y código compartido (contratos de la API). Deben evolucionar juntos sin desincronizarse.

## Decisión

Un solo repositorio con **pnpm workspaces**: `backend/`, `app/`, `packages/shared/`.

- `packages/shared` exporta **código TypeScript fuente** (sin paso de compilación). Vite lo compila en la app; esbuild lo incluye dentro del bundle del backend (`backend/build.mjs`).
- pnpm se activa con Corepack (`packageManager` en `package.json`), versión fijada.
- **Protección de cadena de suministro:** `minimumReleaseAge: 10080` (solo versiones públicas hace ≥ 7 días) y `allowBuilds` (solo paquetes aprobados ejecutan scripts de instalación). Dependabot usa el mismo período de espera.
- Versiones exactas (sin `^`) en todos los `package.json`.

## Alternativas descartadas

- **Repos separados:** contratos duplicados y cambios coordinados más difíciles.
- **npm workspaces:** sin protecciones de cadena de suministro equivalentes; más lento.
- **TypeScript 7:** typescript-eslint aún no lo soporta (`<6.1`). Se usa TypeScript 6.0 hasta que haya soporte.
