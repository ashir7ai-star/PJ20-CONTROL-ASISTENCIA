# Fase 3 — Marcar de verdad (hora del servidor + GPS + selfie) · Plan detallado

> Estado: ✅ **cerrada** · 2026-10-08 (aprobada con D3; D4 aprobada durante la ejecución)
> Reglas aplicables: `CLAUDE.md` §1 (Seguridad), §2 (Integridad), §2B.6 (Selfie), §3 (Privacidad), §8 (Experiencia), §9 (Método)

## 1. Objetivo

Que el botón **Marcar entrada / Marcar salida** registre una marcación real. Cada marcación lleva la **hora del servidor**, la **ubicación GPS exacta** y una **selfie en vivo** que muestre el rostro y el lugar de trabajo. La prueba se hace en celulares reales sobre staging.

## 2. Qué verá el empleado (máximo 2 toques, §8.1)

1. Toca **Marcar entrada**. La app pide la ubicación y abre la **cámara frontal en vivo** con una guía en pantalla: «Estira el brazo: que se vea tu cara y el lugar donde estás».
2. Toca **Tomar foto y marcar** → confirmación con la **hora registrada por el servidor** y la ubicación capturada.

Después, Marcar muestra el estado real: **«Trabajando desde las 7:58 a. m.»** con el contador de tiempo trabajado. Al salir, «Marcar salida» con el mismo flujo.

**Todos los estados diseñados (B.8):**

- Pidiendo ubicación.
- GPS apagado o permiso negado: cómo activarlo en Android y en iPhone.
- Cámara negada.
- Precisión baja (se acepta pero queda para revisión).
- Sin conexión: no se marca (§2.7).
- Error del servidor.
- Éxito.

## 3. Servidor

**Tabla `attendance_records`, inmutable** (§2.4): un trigger impide UPDATE, DELETE y TRUNCATE, y el rol de la API solo tiene SELECT e INSERT, igual que la auditoría. Cada fila guarda:

- empleado y tipo (entrada/salida);
- hora del servidor (`timestamptz`, la única que cuenta) y hora del dispositivo (informativa);
- latitud, longitud, precisión en metros y antigüedad del dato GPS;
- IP real, dispositivo (navegador y sistema);
- llave de la selfie en el almacenamiento privado;
- `review_status` (`ok` / `pending`) con los motivos.

**Endpoints:**

- `GET /api/v1/attendance/status`: estado actual (fuera de turno, o trabajando desde X) y última marcación.
- `POST /api/v1/attendance`: tipo, ubicación y selfie en una sola petición. La foto se valida como JPEG real, de 2 MB como máximo. Se guarda la foto y luego la fila; si algo falla, se borra la foto (nada queda a medias).

**Reglas en el servidor**, como funciones puras con pruebas (§4.8):

- No se permite entrada sobre entrada ni salida sin entrada.
- Sin ubicación no hay marcación.
- Precisión mayor a 100 m: se acepta, pero queda **para revisión** (§2.6).
- Dato GPS de más de 30 s: también para revisión (adelanto de §2B.5).
- Límite de intentos con Redis (§1.9), y cada marcación queda en la auditoría.

**Selfies** (§2B.6, §3.2): bucket privado que nunca se expone a internet; solo administradores con sesión válida las ven, a través de la API (decisión 0004). La foto se toma con `getUserMedia` (cámara en vivo); **no existe opción de galería**.

## 4. Fuera de esta fase (fases ya planeadas)

- Bloqueo de ubicación falsa en Android con el APK y vinculación de un celular por empleado: Fases 4 y 5. Mientras tanto, Android puede marcar desde el navegador **solo en staging**.
- Panel administrativo completo (historial, mapa, revisión, Excel): Fase 6. Ver la decisión D3.

## 5. Decisión para aprobar

**D3. ¿Adelantamos una vista mínima real para el administrador?** Sería una página **«Marcaciones de hoy»** con datos reales: empleado, hora, tipo, enlace al mapa, selfie y aviso de «para revisar». Así podrías comprobar desde ya, en el piloto, lo que marcan los empleados. El resto del panel seguiría siendo prototipo hasta la Fase 6.

- **Recomendado: sí.** Sin esto, las marcaciones existirían pero nadie las podría ver hasta la Fase 6.

## 6. Pruebas

- **Unitarias:** reglas de consistencia, precisión, antigüedad del GPS y validación de la foto.
- **Integración con Postgres, Redis y RustFS reales:** marcación completa, intento de entrada doble (rechazado), intento de borrar o editar una marcación (la base de datos lo impide), foto inválida (rechazada), un empleado no puede ver las selfies ni marcar por otro.
- **App:** cada estado de la pantalla, con pruebas de accesibilidad.
- **Manual en celular real (staging):** Android e iPhone, con GPS apagado, permiso negado, sin conexión y caso exitoso.

## 7. Criterios de aceptación

- [x] Desde tu celular marcas entrada y salida con selfie y GPS; la hora es la del servidor. _(Prueba del dueño en Android, staging, 2026-10-08.)_
- [x] Marcar toma como máximo 2 toques después de abrir la app. _(La primera vez se suma la explicación de permisos.)_
- [x] La base de datos impide editar o borrar marcaciones, aunque se intente directamente.
- [x] Las selfies no son accesibles sin sesión de administrador (vía API, decisión 0004).
- [x] Todos los estados de error tienen pantalla y mensaje claros en español.
- [x] Lint, tipos, pruebas y CI. Lighthouse de Marcar: queda por medir con sesión real sobre staging (pendiente para la Fase 7).

## 8. Riesgos

| Riesgo                                              | Mitigación                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Celulares de gama baja: fotos pesadas, cámara lenta | La foto se reduce en el celular (~1280 px, JPEG ~80 %) antes de enviarla                 |
| iPhone pide permisos distinto                       | Mensajes específicos por sistema; prueba en iPhone real                                  |
| GPS impreciso en interiores                         | Se espera hasta 10 s por mejor precisión; si no mejora, se marca y queda para revisión   |
| Ley 1581: fotos del rostro son datos sensibles      | Solo administradores con sesión, vía API; consentimiento exigido también por el servidor |

**Reversión:** todo en una rama propia con PR. La migración solo agrega tablas nuevas; no toca nada de lo existente.

## 9. Informe de ejecución (2026-10-08)

**Verificación:** shared 12 · backend 39 · app 258 · integración 36 (Postgres, Redis y RustFS reales). Prueba manual del dueño en su Android sobre staging: entrada y salida con foto, ubicación ± 13 m y hora del servidor; la página «Marcaciones de hoy» muestra los registros con la selfie.

**Hallazgos corregidos durante la fase:**

- El consentimiento solo lo exigía la pantalla; ahora también lo exige el servidor (Ley 1581).
- Una URL firmada de S3 obligaba a publicar el almacenamiento; las selfies se sirven por la API con sesión de administrador (decisión 0004, regla §2B.6 actualizada).
- Si el GPS respondía antes que la cámara, el aviso «Buscando tu ubicación…» no se actualizaba.
- **Límites por IP:** toda la oficina comparte una IP pública, así que el límite de marcaciones ahora se cuenta por persona (hash de la sesión). El de inicio de sesión sube a 60 por minuto por IP, porque no hay contraseñas que adivinar.

**D4 (aprobada en ejecución):** página real **Empleados** (alta, rol, desactivar/reactivar, borrar sin historial) sobre los endpoints de la Fase 2. La lista indica el historial de cada persona para avisar antes de intentar borrar.

**Pendiente:** prueba en iPhone; Lighthouse de Marcar con sesión real.
