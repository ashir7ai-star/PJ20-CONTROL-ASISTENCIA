# Fase 6 — Panel administrativo · Plan detallado

> Estado: 🛠️ **en construcción** · 2026-10-10 (aprobado de antemano por el dueño: «todo está aprobado»)
> Reglas aplicables: `CLAUDE.md` §2 (integridad), §2.4 (inmutables; ajustes como registro nuevo), §2.5 (auditoría), §3 (privacidad), §4.8 (lógica en funciones puras), §5, §9

## 1. Objetivo

Que el administrador pueda operar la asistencia del mes **sin tocar la base de datos**:

- revisar las marcaciones dudosas;
- corregir olvidos;
- ver las horas de cada persona;
- exportar a Excel para la nómina;
- ver quién hizo qué.

El empleado también puede consultar sus propias marcaciones (derecho de acceso, Ley 1581 art. 8).

## 2. Modelo: la línea de tiempo efectiva

Las marcaciones **nunca** se editan ni se borran (§2.4). Toda corrección es un registro nuevo, inmutable y auditado. La «línea de tiempo efectiva» de un empleado sale de:

| Fuente                                          | Efecto                                                                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marcación original (`attendance_records`)       | Cuenta, salvo que esté **anulada**                                                                                                                                                                                                 |
| Revisión (`attendance_reviews`)                 | Veredicto sobre una marcación dudosa: «Aprobada» o «Rechazada» (con motivo). La saca de la bandeja. Una marcación rechazada sigue en la línea de tiempo (no rompe la alternancia), pero **el turno que la contiene no suma horas** |
| Corrección «agregar» (`attendance_corrections`) | Una entrada o salida olvidada, con la hora que fija el administrador y un **motivo**                                                                                                                                               |
| Corrección «anular» (`attendance_corrections`)  | Deja sin efecto una marcación o una corrección anterior (p. ej., una doble marca), con motivo                                                                                                                                      |

Las correcciones van **en lote**: agregar la entrada y la salida de un día olvidado, o anular un par marcado por error, se valida junto. Solo se anulan marcaciones o correcciones «agregar» aún vigentes; una anulación no se anula (para restituir, se agrega de nuevo).

**Regla de consistencia:** después de cualquier corrección, la línea efectiva debe alternar entrada → salida → entrada…; si no, la corrección se rechaza con un mensaje claro. **El empleado marca contra la línea efectiva**: si olvidó la salida de ayer y el administrador la agrega, hoy puede marcar entrada con normalidad.

Las horas agregadas por el administrador se ven siempre distintas («Corrección de Nathan: olvidó marcar la salida»). Nunca se confunden con la hora del servidor.

## 3. Horas trabajadas (informativo para la nómina)

Función pura, con pruebas, sobre la línea efectiva:

- **Turnos:** cada entrada con su salida. Un turno sin salida por más de 16 h aparece como **«Salida sin marcar»** y no suma horas hasta que se corrija.
- **Por día de Bogotá** (los turnos que cruzan la medianoche se parten): horas **diurnas** (6:00 a. m.–7:00 p. m.) y **nocturnas** (7:00 p. m.–6:00 a. m., Ley 2466 de 2025). Además, horas en **domingo o festivo**, con los festivos de Colombia calculados (Ley 51 de 1983, Ley Emiliani; Pascua por cómputo).
- **Por semana (lunes a domingo):** total frente a la jornada máxima de **42 h** (Ley 2101 de 2021, vigente desde el 15 de julio de 2026). Lo que pasa de 42 h se muestra como **«Por encima de la jornada»** (posibles horas extra).
- El informe **no liquida valores ni recargos**: muestra las horas clasificadas para que la nómina aplique los porcentajes vigentes. Lo dice explícitamente.

## 4. Entregas

### 6A — Revisión y correcciones

- **Migración:** tablas `attendance_reviews` y `attendance_corrections`, solo inserción, con el trigger `reject_modification()` y permisos SELECT/INSERT para `pj20_app`.
- **Reglas puras:** `effectiveTimeline()` y `timelineError()`.
  - `attendanceStatus` y `markAttendance` pasan a usar la línea efectiva.
  - La fila del empleado sigue bloqueada en la transacción, también al corregir.
- **Endpoints (`/admin`):**
  - `GET /admin/review`: bandeja de marcaciones pendientes;
  - `POST /admin/attendance/:id/review` con `{ decision, note? }`;
  - `POST /admin/corrections`: agregar `{ employeeId, events: [{ kind, at }] (1–2), reason }` o anular `{ targetIds (1–4), reason }`. La hora agregada no puede ser futura ni de hace más de 92 días.
  - Todo queda auditado y con límite de tamaño.
- **Pantallas:**
  - pestaña **«Por revisar»** con contador, que usa el diseño aprobado de `review-screen`;
  - en «Marcaciones»: «Corregir» por registro, «Agregar marcación olvidada» y la señal de las correcciones.

### 6B — Historial, horas y Excel

- **Endpoints:**
  - `GET /admin/attendance?desde&hasta&empleado`: rango de hasta 62 días;
  - `GET /admin/hours?desde&hasta`: horas por empleado y semana;
  - `GET /admin/reports/asistencia.xlsx?desde&hasta`: dos hojas, «Marcaciones» y «Horas».
- **Excel real (.xlsx):** lo arma el servidor con un generador mínimo propio y `fflate` (compresión ZIP, sin dependencias). Las fechas y horas van en `America/Bogota` y el archivo trae la nota «no liquida recargos».
- **Pantallas:**
  - «Marcaciones» con rango de fechas, empleado y solo pendientes;
  - «Horas» por empleado y semana;
  - el botón «Exportar a Excel»;
  - «**En turno ahora**» arriba de «Marcaciones».
- **Mapa:** se mantiene «Ver en mapa» por marcación (abre el mapa del celular o del computador). Un mapa embebido exigiría un tercero con tráfico de datos de ubicación; se descarta en la versión 1 (decisión 0007).

### 6C — Auditoría y «Mis marcaciones»

- Pestaña **«Auditoría»**, con filtro por fecha y acción y paginación. Muestra quién, qué, cuándo y el antes/después, en lenguaje claro.
- **«Mis marcaciones»** para el empleado, desde el menú:
  - sus marcaciones de los últimos 31 días, con las correcciones y su motivo;
  - sus horas de la semana.
  - Usa `GET /me/attendance`, que solo devuelve datos propios.

**Fuera de esta fase:** dispositivos vinculados y señales de fraude (Fase 4), APK (Fase 5).

## 5. Criterios de aceptación

- [ ] Ninguna corrección modifica o borra una marcación: los triggers lo impiden y las pruebas lo verifican.
- [ ] Toda corrección y revisión exige motivo (corrección) o decisión, y queda en `audit_log` con antes/después.
- [ ] Una corrección que rompe la alternancia se rechaza con un mensaje claro.
- [ ] El empleado que olvidó la salida puede marcar entrada después de la corrección.
- [ ] Las horas cuadran con casos calculados a mano: turnos nocturnos, cruce de medianoche, festivos trasladados, semana de más de 42 h, turno abierto.
- [ ] El Excel abre en Excel y Google Sheets con tildes, fechas y horas correctas.
- [ ] Un empleado nunca ve datos de otro: pruebas de permisos en cada endpoint nuevo.
- [ ] Lint, typecheck, pruebas unitarias e integración, build y CI en verde. Todas las pantallas con sus estados (cargando, vacío, error) y axe sin errores.

## 6. Riesgos

| Riesgo                                            | Mitigación                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Un administrador «inventa» horas con correcciones | Motivo obligatorio y auditoría; la corrección se ve siempre como tal, en la app y en el Excel |
| Cálculo de horas mal entendido como liquidación   | Rotulado «informativo»; sin valores en pesos                                                  |
| Festivos mal calculados                           | Pruebas con el calendario oficial de 2025, 2026 y 2027                                        |
| Consultas lentas con meses de datos               | Índices existentes (empleado, hora); rango máximo de 62 días                                  |

**Reversión:** cada entrega es un PR independiente. Las tablas nuevas solo agregan información, así que quitar su uso deja todo como antes.

## 7. Informe de ejecución

### 6A — Revisión y correcciones (2026-10-10) ✅

- **Base de datos:** migraciones `0010`/`0011`. Tablas `attendance_reviews` y `attendance_corrections`, solo inserción: el trigger impide UPDATE, DELETE y TRUNCATE, y la API solo tiene SELECT/INSERT. Restricciones en la base:
  - motivo de 10 a 500 caracteres;
  - el rechazo exige motivo;
  - la forma de «agregar» o «anular»;
  - una sola anulación por objetivo.
- **Reglas puras:** `timeline.ts`, la alternancia con su mensaje en hora de Bogotá. La marcación y el estado del empleado usan la línea efectiva.
- **API:**
  - `GET /admin/review`;
  - `POST /admin/attendance/:id/review`;
  - `POST /admin/corrections`, que agrega 1–2 o anula 1–4 en lote, como máximo 92 días atrás y nunca en el futuro;
  - `GET /admin/attendance`, que ahora incluye correcciones, veredictos y anulaciones.
- **Panel:**
  - pestaña **«Por revisar»** con contador;
  - en «Marcaciones»: Aprobar, Rechazar (con motivo), Anular (ofrece anular la otra mitad del turno) y **«Agregar marcación olvidada»**;
  - las correcciones se ven como tales y las anuladas, tachadas.
- **Verificación:**
  - 72 pruebas de integración, 10 nuevas: bandeja, aprobar, rechazar con motivo, salida olvidada que desbloquea al empleado, día completo, alternancia rota, futura o vieja, anular en par o sola, anular una corrección, dos personas, inmutabilidad y permisos;
  - pruebas de pantalla con axe;
  - recorrido real contra la API local: anular 204, agregar 204, alternancia rota 422 con mensaje claro;
  - capturas en escritorio y celular.
- **Corregido en el camino:**
  - una carrera: aprobar una marcación cerraba el diálogo recién abierto de otra;
  - el encabezado se desbordaba en celular;
  - la fecha salía como «10 De Octubre».
