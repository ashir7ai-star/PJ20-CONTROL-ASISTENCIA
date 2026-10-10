# D8 — Copias de seguridad fuera del servidor · Plan detallado

> Estado: **aprobado** (2026-10-10) · versión 2: Google Drive de nathan@ylevigroup.com (carpeta propia, cifrada, permiso solo sobre sus propios archivos) · en ejecución
> Reglas aplicables: `CLAUDE.md` §1.13 (respaldos diarios fuera del VPS, restauración probada), §3 (Privacidad), §6.3 (nunca dumps en Git), §9 (Método)

## 1. Objetivo

Que un fallo, borrado o ataque al VPS de Hostinger **no haga perder ni un día de registros**. Las marcaciones son pruebas laborales que se conservan durante la relación laboral y 3 años después (D7). Hoy no tienen copia fuera del servidor.

**GitHub no sirve para esto.** Guarda solo el código, nunca los datos. Además, los datos personales y sensibles no pueden ir a un repositorio, y menos a uno público (§6.3).

## 2. Por qué la versión 2

La versión 1 usaba Backblaze B2 con las copias nativas de Easypanel, que solo aceptan destinos tipo S3. El dueño no quiere registrar tarjetas en ningún servicio. **Google Drive** (15 GB gratis, sin tarjeta) no es un destino nativo de Easypanel. Por eso hace falta un pequeño servicio propio de copias.

## 3. Diseño (costo cero, sin tarjeta)

Un servicio nuevo en Easypanel, **`pj20-asistencia-respaldos`**, construido desde el repositorio (`ops/respaldos/`):

- Herramientas: `pg_dump` + [`rclone`](https://rclone.org/drive/), con un reloj interno que corre el trabajo a la hora fijada.
- Destino: una carpeta de Google Drive de una **cuenta de Google dedicada a respaldos** (por ejemplo `respaldos.blazar@gmail.com`). Así no se mezcla con el correo de nadie y se entregan solo los permisos de Drive.
- **Todo va cifrado antes de salir del servidor** ([rclone crypt](https://rclone.org/crypt/)): Google solo ve archivos ilegibles, incluso los nombres. La contraseña de cifrado queda en Easypanel y en una **copia física que guarda el dueño**. Sin ella las copias no se pueden abrir, ni siquiera nosotros.

| Qué                               | Cuándo (hora Colombia)     | Cuántas copias                                                                     |
| --------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| Base de datos (`pg_dump`)         | Todos los días, 2:00 a. m. | **35 diarias**                                                                     |
| Base de datos, copia mensual      | Día 1 de cada mes          | **12 mensuales**                                                                   |
| Selfies (desde el almacenamiento) | Todos los días, 3:00 a. m. | Espejo: lo que se borra en el servidor se borra en la copia, sin papelera de Drive |

- **Mínimo privilegio:** el servicio entra a la base de datos con un usuario propio de **solo lectura** (`pj20_respaldos`). Solo puede escribir en la tabla de resultados de las copias.
- **Aviso en el panel, sin cuentas extra:** cada copia registra si salió bien. El panel del administrador muestra «**Última copia de seguridad: hoy 2:00 a. m. ✓**» y un **aviso rojo** si pasan más de 36 horas sin una copia buena.
- **Uso estimado:** menos de 2 GB de los 15 GB (base de datos de pocos MB y unos 1,5 GB de selfies de 90 días).

## 4. Restauración probada (obligatoria, §1.13)

1. Descargar y descifrar la última copia, y restaurarla en un **Postgres temporal** aparte, nunca sobre la base real.
2. Verificar con `node dist/contar-registros.js` que los conteos por tabla coinciden con la base real.
3. Restaurar una selfie y abrirla.
4. Repetir cada **3 meses**, anotado en la guía.

## 5. Cambios

- **Código:**
  - el servicio `ops/respaldos/` (Dockerfile + script);
  - la tabla `backup_runs` y el usuario `pj20_respaldos` (migración);
  - el aviso en el panel;
  - el comando `contar-registros`;
  - la guía `docs/deploy/RESPALDOS.md` con el **procedimiento de recuperación paso a paso**.
- **Política de privacidad:** informar que la empresa usa proveedores de nube (servidor y copias) como **encargados del tratamiento**, y que las copias de seguridad están cifradas y se conservan como máximo **12 meses**, solo para recuperación.

## 6. Lo que hace el dueño (guiado)

1. Crear la cuenta de Google dedicada a respaldos (gratis).
2. Instalar `rclone` en su computador y autorizar el acceso a Drive. Toma 2 minutos: `rclone authorize "drive"`. El permiso resultante se pega **directamente en Easypanel**, nunca en el chat.
3. Guardar la contraseña de cifrado en un lugar físico seguro.

**Capa adicional:** revisar en el panel de Hostinger si el VPS tiene activadas las copias semanales incluidas en el plan, sin costo. No reemplazan a Drive, porque están en el mismo proveedor, pero suman.

## 7. Criterios de aceptación

- [ ] Copia diaria y mensual de la base de datos cifrada en Drive.
- [ ] Espejo de selfies cifrado en Drive; lo borrado por conservación también desaparece de la copia.
- [ ] El panel muestra la última copia buena y alerta si pasan 36 horas.
- [ ] Restauración probada en un Postgres temporal, con los conteos iguales a los de la base real.
- [ ] Guía de recuperación escrita y política actualizada.

## 8. Riesgos

| Riesgo                                    | Mitigación                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Se pierde la contraseña de cifrado        | Copia física del dueño; la guía lo exige antes de activar las copias                  |
| Google revoca o vence el permiso de Drive | El panel alerta a las 36 horas sin copia; la guía explica cómo renovarlo              |
| Se llenan los 15 GB                       | Con menos de 2 GB estimados hay margen; el aviso del panel incluye el error si ocurre |
| Alguien entra a la cuenta de Drive        | Los archivos están cifrados; cuenta dedicada con verificación en dos pasos            |

**Reversión:** detener el servicio `pj20-asistencia-respaldos`. Las copias en Drive se borran a mano si se desea.
