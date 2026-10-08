# Fase 2 — Backend núcleo y autenticación · Plan detallado

> Estado: ✅ **cerrada** · 2026-10-08 (aprobada con D1 y D2 el 2026-10-07)
> Reglas aplicables: `CLAUDE.md` §1 (Seguridad), §3 (Privacidad), §4 (Arquitectura), §9 (Método)

## 1. Objetivo

Construir la base real del sistema: **base de datos**, **inicio de sesión con Google**, **sesiones seguras**, **roles** y **auditoría**, conectados de punta a punta con la pantalla de inicio de sesión ya aprobada.

Al terminar, una persona autorizada podrá iniciar sesión con su cuenta de Google y el sistema sabrá si es empleado o administrador. Una persona no autorizada será rechazada con un mensaje claro.

**No incluye:** marcaciones, selfies y GPS (Fase 3), antifraude (Fase 4), APK (Fase 5), panel con datos reales (Fase 6).

## 2. Decisiones que necesito que apruebes

### D1 · Inicio de sesión: "ID token" de Google con _nonce_

- La app muestra el botón oficial de Google (Google Identity Services). Google entrega una **credencial firmada** (ID token) que el backend **verifica** (firma con las llaves públicas de Google, emisor, audiencia, vencimiento y correo verificado).
- Un _**nonce**_ de un solo uso, emitido por nuestro servidor, impide reutilizar una credencial robada.
- **Ventaja:** no hay "client secret" que guardar ni que pueda filtrarse. El mismo mecanismo servirá para el APK de Android en la Fase 5.

### D2 · Sesiones del lado del servidor (cambio a la regla §1.4)

La regla actual dice "access token de 15 min + refresh token". Propongo **sesiones opacas del lado del servidor**, el modelo de bancos y de Google:

- Al iniciar sesión se genera un **token aleatorio de 256 bits**. Se guarda solo su **huella (hash)** en la base de datos y el token viaja en una cookie `httpOnly`, `Secure`, `SameSite=Strict`.
- **Revocación instantánea:** desactivar a un empleado o cerrar su sesión la invalida **en el acto**. Con tokens de 15 minutos quedaría hasta 15 minutos de acceso.
- **Duración:** empleado, 30 días con renovación automática (no tiene que iniciar sesión cada día); administrador, 12 horas.
- Más simple implica menos superficie de error. Si lo apruebas, actualizo la regla §1.4.

## 3. Base de datos (PostgreSQL 18, migraciones con Drizzle)

| Tabla       | Para qué                                                                     | Protección                                                        |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `employees` | Lista blanca: nombre, correo (único, sin distinguir mayúsculas), rol, activo | Solo se desactiva si tiene historial (regla de la Fase 1)         |
| `sessions`  | Sesiones activas: hash del token, dispositivo, IP, vencimiento, revocación   | El token real nunca se guarda                                     |
| `consents`  | Aceptación del consentimiento (versión, fecha, IP, dispositivo)              | Solo se inserta, nunca se modifica                                |
| `audit_log` | Quién hizo qué y cuándo, con valores antes/después                           | **Inmutable**: la BD rechaza UPDATE y DELETE (trigger + permisos) |

- **Dos usuarios de base de datos:** uno para migraciones (dueño) y otro para la app, **sin permisos** para borrar la auditoría ni alterar tablas.
- Las migraciones son archivos SQL versionados en el repositorio y se aplican igual en local, CI y Easypanel.

## 4. API (`/api/v1`)

| Endpoint                      | Quién      | Qué hace                                                                  |
| ----------------------------- | ---------- | ------------------------------------------------------------------------- |
| `POST /auth/nonce`            | Público    | Entrega un _nonce_ de un solo uso (5 min)                                 |
| `POST /auth/google`           | Público    | Verifica la credencial de Google, aplica la lista blanca y crea la sesión |
| `POST /auth/logout`           | Con sesión | Cierra la sesión actual                                                   |
| `GET /me`                     | Con sesión | Quién soy, rol, consentimiento pendiente                                  |
| `POST /me/consent`            | Con sesión | Registra la aceptación (Ley 1581)                                         |
| `GET /admin/employees`        | Admin      | Lista de usuarios                                                         |
| `POST /admin/employees`       | Admin      | Agregar usuario                                                           |
| `PATCH /admin/employees/:id`  | Admin      | Cambiar rol, desactivar o reactivar                                       |
| `DELETE /admin/employees/:id` | Admin      | Eliminar (solo sin historial)                                             |
| `GET /admin/audit`            | Admin      | Registro de auditoría                                                     |

- Las **reglas de roles de la Fase 1** (nadie se quita su propio rol, siempre al menos un administrador, etc.) pasan a `packages/shared`: **las mismas reglas** en la app y en el servidor. El servidor siempre decide.
- Desactivar a un usuario **revoca todas sus sesiones** al instante.
- Documentación OpenAPI generada automáticamente desde los esquemas.

## 5. Seguridad

- **Rate limiting** con Redis: 10 intentos por minuto por IP en el inicio de sesión y límites generales para el resto.
- **Protección CSRF:** cookie `SameSite=Strict`, más verificación del encabezado `Origin` en toda petición que modifica datos.
- **Mensajes de rechazo sin pistas:** a un correo no autorizado se le responde "Tu cuenta no está autorizada. Pide acceso a tu administrador", sin revelar si existe o no.
- Cabecera CSP actualizada para permitir **solo** los dominios oficiales de Google Sign-In.
- **Primer administrador:** se crea con un comando explícito (`pnpm admin:crear correo@...`), ejecutado una vez. Nunca queda un usuario por defecto en el código.

## 6. Frontend (mínimo, para probar de punta a punta)

- El botón **"Continuar con Google"** de la pantalla aprobada pasa a funcionar de verdad.
- Pantalla de **cuenta no autorizada** (mismo estilo que los demás errores).
- Tras iniciar sesión: consentimiento, si falta, y luego Marcar (aún con datos de ejemplo) para empleados o el panel para administradores.
- Botón **Cerrar sesión**.
- El prototipo en GitHub Pages **no cambia**: sigue con datos de ejemplo, porque allí no hay servidor.

## 7. Pruebas

- **Verificación de credenciales de Google con llaves de prueba propias:** credencial válida, firma falsa, otra audiencia, vencida, correo no verificado y _nonce_ reutilizado. Todas deben rechazarse salvo la válida.
- **Integración con Postgres y Redis reales:** migraciones, flujo completo de sesión, revocación al desactivar, auditoría inmutable (se intenta borrar y debe fallar).
- **Permisos:** un empleado **nunca** accede a `/admin/*`; las reglas de roles se aplican en el servidor aunque alguien salte la interfaz.
- **Cookies:** banderas `httpOnly`, `Secure`, `SameSite` verificadas en las respuestas.
- Prueba manual real: iniciar sesión con tu cuenta de Google en `localhost`.

## 8. Criterios de aceptación

- [x] Inicias sesión con tu Google en `localhost` y el sistema te reconoce como administrador. _(Prueba manual del dueño, 2026-10-08.)_
- [x] Un correo no autorizado ve "cuenta no autorizada" y no obtiene sesión. _(Pruebas de integración y de la app.)_
- [x] Desactivar a un usuario corta su sesión de inmediato.
- [x] La auditoría registra cada cambio de usuarios y la base de datos impide alterarla.
- [x] Un empleado no puede usar ningún endpoint de administración (403).
- [x] Todas las pruebas de seguridad en verde; lint, tipos, build y CI en verde.
- [x] Lighthouse de la app sin cambios negativos. _(Marcar 89–90; excepción aprobada para el inicio de sesión, §11.)_

## 9. Riesgos

| Riesgo                                                                 | Mitigación                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google en modo "Prueba" solo deja entrar a usuarios de prueba listados | Para desarrollo es suficiente; antes del piloto se "publica" la app de Google (los permisos básicos de correo y perfil no requieren revisión de Google) |
| Un error en una migración daña datos                                   | Migraciones probadas en CI con BD real y aplicadas primero en staging; respaldo antes de migrar en producción                                           |
| Cookies del APK (Capacitor) en otro origen                             | Previsto: el mismo token de sesión vía encabezado `Authorization` guardado en el almacén seguro de Android (Fase 5)                                     |

**Reversión:** todo en la rama `feat/fase-2-backend`; nada llega a `main` sin PR y CI en verde.

## 10. Lo que necesito de ti

1. **Aprobar este plan**, incluidas las decisiones **D1** y **D2**.
2. **Proyecto en Google Cloud Console** (detalle en la respuesta del chat).
3. **Correos de los administradores iniciales.**

## 11. Informe de ejecución (2026-10-07 → 2026-10-08)

**Hecho y verificado en local:**

- Pruebas: shared 12 · backend 25 · app 226 · integración con Postgres y Redis reales 26. Lint, tipos y build en verde.
- La base de datos se probó atacándola: la API no puede alterar ni borrar la auditoría ni los consentimientos, ni crear o borrar tablas; ni siquiera el dueño puede modificar la auditoría.
- Carga inicial del celular: 3 archivos y unos 104 KB comprimidos. Un guardián en el build impide que entren el panel de administración o la librería de validación (el servidor ya valida cada respuesta).
- Error corregido: si el servidor no respondía, el botón de Google pedía el _nonce_ en bucle. Ahora muestra un aviso con «Reintentar» y lo cubre una prueba.

**Lighthouse móvil** (3 corridas, con la API real):

| Pantalla               | Rendimiento | Accesibilidad | Buenas prácticas |
| ---------------------- | ----------- | ------------- | ---------------- |
| Marcar (uso diario)    | 89–90       | 100           | 100              |
| Inicio de sesión (`/`) | 84–87       | 100           | 96               |

**Excepción a B.12 (aprobada por el dueño el 2026-10-08):** la pantalla de inicio de sesión queda por debajo de 90 en rendimiento por el script oficial de Google. D1 lo exige y su ejecución es la tarea más larga de la página (≈260 ms). Sin ese script, la pantalla marca 85–87. La puntuación de buenas prácticas (96) baja por el `401` normal de `/me` cuando nadie ha iniciado sesión. Esta pantalla se ve una vez cada 30 días por empleado; Marcar, que es la de todos los días, cumple.

**Prueba manual real (2026-10-08):** el dueño inició sesión con Google (nathan@ylevigroup.com) en `localhost` y llegó a Marcar como administrador. Durante la prueba aparecieron tres problemas, todos corregidos y cubiertos por pruebas:

- El cliente OAuth no tenía el origen `localhost` registrado (error `origin_mismatch`). Se reutilizó el cliente del proyecto anterior, limpiando sus direcciones.
- En el panel (aún prototipo), «Cerrar sesión» no tenía acción y «Marcar mi asistencia» llevaba al Marcar de ejemplo. Ahora actúan sobre la sesión real.
- La animación aparecía quieta porque Windows tenía apagados los efectos de animación. La app respeta esa preferencia a propósito (B.9). De paso se corrigió la forma en que se cancela su arranque.

**Pendiente para las siguientes fases:** el panel de administración sigue con datos de ejemplo hasta la Fase 6. Las pruebas en celular necesitan HTTPS (Google, GPS, cámara y la cookie `__Host-`), por eso el despliegue a staging se adelanta. Ver `docs/PLAN.md`.
