# Fase 2B — Staging en Easypanel (adelantado de la Fase 7) · Plan detallado

> Estado: **aprobado** · en ejecución · 2026-10-08
> Reglas aplicables: `CLAUDE.md` §1 (Seguridad), §7 (Despliegue), §9 (Método)

## 1. Objetivo

Publicar la app en el servidor de Easypanel con **HTTPS** para poder probarla **en celulares reales** desde ya. Sin HTTPS, el celular no puede iniciar sesión con Google, ni usar GPS, cámara o la cookie segura de sesión.

Se adelanta solo la parte de **staging** de la Fase 7. El piloto con empleados y los respaldos automáticos siguen en la Fase 7.

## 2. Por qué ahora

La Fase 3 (marcar con selfie y GPS) solo se acepta "de punta a punta en celular real". Con staging listo, cada avance de la Fase 3 se prueba en el celular el mismo día.

## 3. Arquitectura en Easypanel

Un proyecto `pj20-staging` con cinco servicios en la red interna de Easypanel:

| Servicio   | Origen                                      | Expuesto a internet                   |
| ---------- | ------------------------------------------- | ------------------------------------- |
| `postgres` | Servicio Postgres de Easypanel (versión 18) | **No**                                |
| `redis`    | Servicio Redis de Easypanel, con contraseña | **No**                                |
| `storage`  | RustFS (imagen Docker), bucket privado      | **No**                                |
| `api`      | Este repositorio · `backend/Dockerfile`     | Solo `/api` del dominio de la app     |
| `app`      | Este repositorio · `app/Dockerfile`         | Sí: `https://…easypanel.host` (HTTPS) |

- Mismo dominio para la app y la API (§7.3, §7.5): el dominio entrega `/api` al servicio `api` y el resto a `app`. Así la cookie `__Host-` y la protección por origen funcionan igual que en local.
- Contraseñas generadas por Easypanel y guardadas solo en sus variables de entorno. Nunca en el repositorio ni en el chat.
- Usuarios de base de datos como en local: dueño `pj20` solo para migraciones y `pj20_api` con mínimos privilegios para la API.

## 4. Cambios en el código (pequeños)

1. `app/Dockerfile`: recibir `VITE_GOOGLE_CLIENT_ID` como argumento de compilación. Hoy no lo recibe y el botón de Google no aparecería.
2. Guía de despliegue `docs/deploy/STAGING.md`: pasos exactos de Easypanel, variables y comandos de migración, para repetirlo en producción.
3. Prueba en CI que compila la imagen de la app con el argumento y verifica que el Client ID quedó incluido.

## 5. Pasos (tú en Easypanel, yo te guío con valores exactos)

1. Crear el proyecto y los servicios `postgres`, `redis` y `storage`.
2. Crear `api` y `app` desde GitHub. El repositorio es público, así que no hace falta token.
3. Configurar el dominio: `/api` → `api` y `/` → `app`.
4. En la consola del servicio `api`: `node dist/migrate.js`, `node dist/db-usuario-app.js` y `node dist/admin-crear.js nathan@ylevigroup.com "Nathan"`.
5. Google Cloud: agregar el dominio HTTPS de staging a los orígenes autorizados del cliente.
6. Probar en tu celular.

## 6. Criterios de aceptación

- [ ] `https://…/api/health` responde OK y Postgres, Redis y RustFS no son accesibles desde internet.
- [ ] Desde tu celular (Android y, si es posible, iPhone): inicias sesión con Google, aceptas el consentimiento, llegas a Marcar, entras al panel y cierras sesión.
- [ ] Cabeceras de seguridad (HSTS, CSP) presentes; la cookie de sesión es `Secure` y `HttpOnly`.
- [ ] Lighthouse móvil sobre staging, con red real.
- [ ] Cada push a `main` se puede redesplegar con un clic (o automáticamente).

## 7. Riesgos y reversión

| Riesgo                                        | Mitigación                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Exponer por error Postgres o Redis            | No se les asigna dominio ni puerto público; se verifica desde fuera        |
| Staging se confunda con producción            | Base de datos y secretos propios; solo se cargan administradores y testers |
| Cuando el repositorio pase a privado (Fase 4) | Easypanel usará un token de GitHub de solo lectura                         |
| Consumo de recursos del VPS                   | Servicios livianos; se revisa el uso de memoria tras desplegar             |

**Reversión:** borrar el proyecto `pj20-staging` en Easypanel; no afecta ningún otro servicio del VPS.
