# 0004 — Las selfies se entregan a través de la API, no con URLs firmadas de S3

- **Estado:** aceptada · 2026-10-08 (Fase 3)
- **Reglas relacionadas:** `CLAUDE.md` §2B.6, §3.2, §1.11

## Contexto

`CLAUDE.md` §2B.6 pide que las selfies «solo se accedan con URLs firmadas de corta duración». Una URL prefirmada de S3 apunta al servidor de almacenamiento. En Easypanel, RustFS vive solo en la red interna (`ashir_pj20-asistencia-storage:9000`), así que el navegador del administrador no puede abrir esas URLs. La única forma de usarlas sería **publicar el almacenamiento en internet**.

## Decisión

El bucket sigue **100 % privado**. La API sirve cada selfie en `GET /api/v1/admin/attendance/:id/selfie`, que:

- exige una **sesión de administrador en cada petición** (cookie `__Host-`, `SameSite=Strict`);
- responde con `Cache-Control: private, no-store`, para que ni el navegador ni los proxies guarden la foto.

## Por qué es más seguro que una URL firmada

| Riesgo                                  | URL firmada de 5 min                        | API con sesión                           |
| --------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| El enlace se reenvía (WhatsApp, correo) | Cualquiera lo abre mientras no venza        | Sin sesión de administrador responde 401 |
| Se desactiva al administrador           | Sus enlaces siguen funcionando hasta vencer | Acceso cortado al instante               |
| Superficie expuesta                     | El almacenamiento queda publicado           | El almacenamiento nunca sale a internet  |

## Alternativas descartadas

- **Publicar RustFS con su propio dominio y usar URLs prefirmadas:** expone el almacenamiento y permite reenviar enlaces.
- **URLs propias firmadas con HMAC:** añaden un secreto más que administrar, sin ventaja sobre la sesión.

## Consecuencia

El texto de `CLAUDE.md` §2B.6 se actualiza: «solo los administradores, con sesión válida, a través de la API; el almacenamiento nunca se expone».
