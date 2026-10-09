# D6 — Solicitudes de acceso · Plan detallado

> Estado: ✅ **implementado** · 2026-10-09 (falta la prueba manual en celular)
> Reglas aplicables: `CLAUDE.md` §1 (Seguridad), §2.5 (Auditoría), §3 (Privacidad), §9 (Método)

## 1. Objetivo

Que una persona cuya cuenta de Google **no está registrada** pueda **pedir acceso** desde la pantalla «Tu cuenta no está autorizada», y que el administrador la **apruebe o rechace** desde el panel, sin tener que comunicarse por fuera.

## 2. Qué verá la persona

1. Inicia sesión con Google → «Tu cuenta no está autorizada».
2. Nuevo botón **«Solicitar acceso»**, con un aviso breve: «Enviaremos tu nombre y tu correo de Google a BLAZAR ENERGY para revisar tu solicitud».
3. Confirmación: **«Solicitud enviada»**. Cuando el administrador la apruebe, podrá entrar con el mismo botón de Google.
4. Si vuelve a intentar antes de ser aprobada, ve **«Tu solicitud está pendiente»**, en lugar de pedir otra vez.

## 3. Qué verá el administrador

En **Empleados**, una sección **«Solicitudes pendientes»** con nombre, correo y fecha, y un aviso numérico en la pestaña. Para cada solicitud:

- **Aprobar:** crea al empleado, o lo reactiva si estaba desactivado. Podrá iniciar sesión de inmediato.
- **Rechazar:** la solicitud se cierra y la persona sigue sin acceso.

Las dos acciones quedan en la auditoría.

## 4. Seguridad (lo importante)

- **Nadie puede inventar solicitudes a nombre de otro.** El nombre y el correo **no se escriben a mano**: los da Google, ya verificados por el servidor en el inicio de sesión fallido. El servidor deja un comprobante de un solo uso en una cookie protegida (HttpOnly, 15 minutos), y solo con ese comprobante se puede enviar la solicitud.
- **Una solicitud pendiente por correo**, con límite de intentos, para evitar abusos.
- **Pedir acceso no da acceso:** la persona sigue sin poder entrar hasta que un administrador apruebe.

## 5. Privacidad (Ley 1581)

- Se guarda solo lo mínimo: nombre, correo, fecha y estado.
- Las solicitudes rechazadas o atendidas se borran a los 30 días.
- El aviso del punto 2 informa qué se envía y para qué, antes de que la persona toque el botón.

## 6. Cambios

- **Base de datos:** tabla `access_requests` (correo único mientras esté pendiente).
- **API:**
  - `POST /api/v1/access-requests`, con el comprobante de la cookie;
  - `GET /api/v1/admin/access-requests`;
  - `POST /api/v1/admin/access-requests/:id/approve`;
  - `POST /api/v1/admin/access-requests/:id/reject`.
- **App:** pantallas «Solicitar acceso», «Solicitud enviada» y «Solicitud pendiente»; sección «Solicitudes pendientes» en Empleados.

## 7. Pruebas

- **Integración:**
  - solicitar sin comprobante → rechazado;
  - con comprobante → creada;
  - solicitud duplicada → «pendiente»;
  - aprobar → la persona puede iniciar sesión;
  - rechazar → sigue sin acceso;
  - un empleado no ve ni aprueba solicitudes.
- **App:** cada pantalla nueva, con pruebas de accesibilidad.
- **Manual:** en tu celular, con una cuenta nueva, de punta a punta.

## 8. Fuera de alcance

**Avisos por correo o WhatsApp** al administrador y a la persona. Requieren un servicio de envío; se evaluará por separado manteniendo el costo cero. Mientras tanto, el panel muestra el número de solicitudes pendientes.

## 9. Reversión

Rama propia con PR. La migración solo agrega una tabla nueva.

## 10. Informe de ejecución (2026-10-09)

- **Verificación:** shared 12 · backend 39 · app 273 · integración 48. Seis pruebas de integración nuevas:
  - sin comprobante no se puede pedir ni consultar;
  - solicitud creada y no duplicada;
  - aprobar → la persona inicia sesión;
  - aprobar a un desactivado → se reactiva;
  - rechazar → sigue sin acceso;
  - un empleado no ve ni resuelve solicitudes.
- **Comprobante:** cookie `__Host-pj20_solicitud` (HttpOnly, Secure, `SameSite=Strict`, 15 min); Redis guarda solo su hash, junto con el nombre y el correo verificados por Google.
- **Panel:** sección «Solicitudes pendientes» en Empleados, con un número en la pestaña.
- **Pendiente:** prueba manual en celular, de punta a punta, con una cuenta nueva.
