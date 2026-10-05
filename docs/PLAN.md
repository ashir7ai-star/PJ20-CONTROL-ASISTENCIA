# PJ20 — Plan maestro de desarrollo

> Estado: **borrador para aprobación** · Última actualización: 2026-10-05
> Reglas del proyecto: [`CLAUDE.md`](../CLAUDE.md). Cada fase tendrá su propio plan detallado, aprobado antes de escribir código.

## Alcance de la versión 1

**Incluye**

- Inicio de sesión con Google (Gmail y correos corporativos), solo correos autorizados.
- Dos roles: **empleado** (solo marcar) y **administrador** (marcar + panel completo).
- Marcación de entrada/salida con hora del servidor, ubicación GPS exacta y selfie en vivo.
- Antifraude por capas (ver `CLAUDE.md` §2B), con protección nativa completa en Android (APK).
- Panel administrativo: asistencia en vivo, historial, mapa, selfies, alertas de fraude, empleados, dispositivos, ajustes y exportación a Excel.
- ~30 empleados, mayoría Android (proporción exacta desconocida: se soportan Android e iPhone por igual).

**No incluye (fases futuras)**

- Cálculo de horas extra y recargos según ley colombiana.
- Reconocimiento facial automático (comparar selfie con foto registrada).
- Sedes y geocercas.

**Restricción:** costo cero — sin tiendas de apps ni servicios pagos.

## Arquitectura

```
 Celular Android ──(APK Capacitor)──┐
 iPhone / PC ─────(PWA navegador)───┤  HTTPS
                                    ▼
                        ┌── Easypanel (Hostinger) ──────────────┐
                        │  app (PWA estática)                   │
                        │  backend (Fastify API /api/v1)        │
                        │  postgres · redis · rustfs (selfies)  │  ← red interna, no expuestos
                        └───────────────────────────────────────┘
```

Mapas: Leaflet + OpenStreetMap (gratis). Exportación: Excel generado en el backend.

---

## Fases

Cada fase termina con: verificación completa (lint, typecheck, pruebas, build, prueba real, regresiones), informe y aprobación.

### Fase 0 — Fundaciones

- Repositorio privado en GitHub, monorepo (`backend/`, `app/`, `packages/shared/`, `docs/`).
- `docker-compose` local con Postgres, Redis y RustFS (S3).
- TypeScript estricto, ESLint, Prettier, pruebas (Vitest), GitHub Actions (lint → typecheck → test → build).
- Validación de variables de entorno al arrancar; endpoint `/api/health`.
- **Aceptación:** `docker compose up` levanta todo, CI en verde, nada de secretos en el repo.

### Fase 1 — Diseño (antes de programar pantallas)

- Sistema de diseño: tokens (color, tipografía, espaciado, radios, sombras), modo claro/oscuro.
- Prototipo visual navegable de: inicio de sesión, consentimiento, marcar (todos sus estados), confirmación, panel administrativo.
- **Aceptación:** apruebas el diseño antes de construirlo.

### Fase 2 — Backend núcleo y autenticación

- Esquema de BD con migraciones: empleados, roles, sesiones, dispositivos, consentimientos, marcaciones (inmutables), ajustes, eventos de fraude, auditoría.
- Login con Google verificado en el servidor, lista blanca, sesiones seguras con rotación, roles y permisos.
- Rate limiting, cabeceras de seguridad, formato de errores, logs estructurados, documentación OpenAPI.
- Carga inicial del primer administrador.
- **Aceptación:** pruebas de permisos (un empleado nunca accede a datos ajenos ni a `/admin`).

### Fase 3 — App del empleado (PWA)

- Login, consentimiento de datos (Ley 1581), pantalla de marcar en máximo 2 toques.
- Selfie en vivo con cámara frontal + GPS con precisión; subida segura al almacenamiento S3 (RustFS).
- Todos los estados: cargando, sin GPS, permiso negado, sin conexión, error, éxito.
- **Aceptación:** marcar de punta a punta en celular real; Lighthouse ≥ 90.

### Fase 4 — Antifraude en el servidor

- Vinculación de un dispositivo por empleado (passkey/WebAuthn en PWA).
- Señales de sospecha: velocidad imposible, coordenadas repetidas o "perfectas", IP vs GPS, ubicación vieja, baja precisión.
- Registro de eventos de fraude.
- **Aceptación:** pruebas automáticas que simulan cada tipo de fraude.

### Fase 5 — APK Android (Capacitor)

- Empaquetar la misma app como APK.
- Plugin nativo: detección de ubicación simulada y de app de ubicación falsa configurada.
- Llave en Android Keystore + Key Attestation verificada en el servidor; dispositivo vinculado.
- El servidor exige APK para empleados Android y una versión mínima.
- Firma del APK, descarga desde nuestro servidor, aviso de actualización.
- **Aceptación:** probado con Fake GPS real en un Android → la marcación se bloquea y queda registrada.

### Fase 6 — Panel administrativo

- Resumen en vivo: quién está trabajando, llegadas y alertas del día.
- Historial filtrable con mapa y selfies (URLs firmadas).
- Bandeja de revisión de marcaciones sospechosas.
- Gestión de empleados (alta, baja, rol) y dispositivos (aprobar cambio de celular).
- Ajustes de marcaciones con motivo; registro de auditoría visible.
- Exportación a Excel.
- **Aceptación:** pruebas de punta a punta de cada flujo administrativo.

### Fase 7 — Despliegue y piloto

- Staging en Easypanel (dirección con HTTPS de Easypanel), respaldos diarios de Postgres fuera del VPS con restauración probada.
- Piloto con 3–5 empleados (Android e iPhone) durante una semana.
- **Aceptación:** cero errores críticos en el piloto.

### Fase 8 — Producción

- Subdominio de la empresa, entorno de producción, carga de los 30 empleados, guía corta de instalación para empleados.

---

## Pendientes del dueño del proyecto

| #   | Pendiente                                                                                           | Necesario para |
| --- | --------------------------------------------------------------------------------------------------- | -------------- |
| 1   | ~~Crear repositorio privado en GitHub~~ ✅ https://github.com/ashir7ai-star/PJ20-CONTROL-ASISTENCIA | Fase 0         |
| 2   | Crear proyecto en Google Cloud Console + ID de cliente OAuth (origen `http://localhost:5173`)       | Fase 2         |
| 3   | Correos de los administradores                                                                      | Fase 2         |
| 4   | Un Android (y si es posible un iPhone) para pruebas reales                                          | Fases 3 y 5    |
| 5   | Subdominio de la empresa                                                                            | Fase 8         |

## Registro de estado

| Fase                     | Estado                               |
| ------------------------ | ------------------------------------ |
| 0 — Fundaciones          | ✅ Implementada (falta CI en GitHub) |
| 1 — Diseño               | Pendiente                            |
| 2 — Backend núcleo       | Pendiente                            |
| 3 — App empleado         | Pendiente                            |
| 4 — Antifraude servidor  | Pendiente                            |
| 5 — APK Android          | Pendiente                            |
| 6 — Panel administrativo | Pendiente                            |
| 7 — Despliegue y piloto  | Pendiente                            |
| 8 — Producción           | Pendiente                            |
