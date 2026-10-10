# Copias de seguridad (D8) — configuración y recuperación

Copia **diaria y mensual** de la base de datos y **espejo diario** de las selfies, **cifrados** con [rclone crypt](https://rclone.org/crypt/) antes de salir del servidor. El destino es la carpeta «PJ20-respaldos» del Google Drive de nathan@ylevigroup.com. El servicio solo tiene permiso sobre los archivos que él mismo crea (`drive.file`), nunca sobre el resto del Drive.

| Qué              | Hora (Colombia)   | Dónde (dentro del cifrado) | Conservación                    |
| ---------------- | ----------------- | -------------------------- | ------------------------------- |
| Base de datos    | 2:00 a. m. diario | `base/diaria/`             | 35 días                         |
| Base de datos    | Día 1 de cada mes | `base/mensual/`            | 12 meses                        |
| Selfies (espejo) | 3:00 a. m. diario | `fotos/`                   | Igual que el servidor (90 días) |

El panel del administrador muestra «Última copia de seguridad: … ✓», o una **alerta roja** si pasan más de 36 horas sin una copia buena.

> **La contraseña de cifrado (`RESPALDOS_CLAVE` y `RESPALDOS_SAL`) es la única llave de las copias.** Si se pierde, las copias no se pueden abrir. Guárdala **también fuera del computador** (papel en un lugar seguro o gestor de contraseñas) antes de activar el servicio.

## 1. Configuración (una vez)

### 1.1 Permiso de Google Drive (en tu computador)

1. Instala rclone: en PowerShell, `winget install Rclone.Rclone`, y abre una terminal nueva.
2. Ejecuta:
   ```powershell
   rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"
   ```
   (El texto final pide el permiso limitado `drive.file`.)
3. Se abre el navegador: entra con **nathan@ylevigroup.com**. Google debe decir que la app verá **solo los archivos que uses con ella**. Acepta.
4. La terminal imprime un bloque entre `Paste the following into your remote machine --->` y `<---End paste`. Ese texto `{…}` es el **permiso**: es un secreto. Va directo a Easypanel (paso 1.3), **nunca al chat**.

### 1.2 Usuario de solo lectura en la base de datos

En `pj20-asistencia-api` → Environment, agrega `BACKUP_DATABASE_URL` (del archivo local `.env.respaldos`) → **Save** → **Deploy**. Luego, en la consola **`>_`** → **Sh**:

```sh
node dist/migrate.js
node dist/db-usuario-respaldos.js
```

### 1.3 Servicio `pj20-asistencia-respaldos`

**+ → App**, Service Name `pj20-asistencia-respaldos`:

- **Source → Github:** `ashir7ai-star/PJ20-CONTROL-ASISTENCIA`, `main`, Build Path `/`.
- **Build:** Dockerfile, File `ops/respaldos/Dockerfile`.
- **Environment:**
  ```
  TZ=America/Bogota
  BACKUP_DATABASE_URL=<del archivo .env.respaldos>
  RESPALDOS_CLAVE=<del archivo .env.respaldos>
  RESPALDOS_SAL=<del archivo .env.respaldos>
  PERMISO_DRIVE=<el texto del paso 1.1, en una sola línea>
  S3_ENDPOINT=http://ashir_pj20-asistencia-storage:9000
  S3_BUCKET=pj20-selfies
  S3_ACCESS_KEY=<USUARIO_DE_RUSTFS>
  S3_SECRET_KEY=<SECRETO_DE_RUSTFS>
  ```
- `<USUARIO_DE_RUSTFS>` y `<SECRETO_DE_RUSTFS>`: los mismos valores de `S3_ACCESS_KEY` y `S3_SECRET_KEY` de `pj20-asistencia-api`.
- **Sin dominio** ni puerto expuesto.
- **Deploy.** Los logs deben decir «Programador de respaldos activo».

### 1.4 Primera copia (sin esperar a las 2:00)

Consola del servicio de respaldos (**Sh**): `respaldar todo`. Debe responder «✓ Base de datos respaldada… ✓ Selfies respaldadas…». En Drive aparece la carpeta **PJ20-respaldos** con archivos de nombres ilegibles; eso es el cifrado.

## 2. Prueba de restauración (al configurar y cada 3 meses)

Nunca sobre la base real. En la consola del servicio de respaldos:

```sh
restaurar listar
psql "$BACKUP_DATABASE_URL" -c "SELECT 1"     # conexión OK
```

1. Crea un **Postgres temporal** en Easypanel (`pj20-asistencia-prueba-restauracion`, imagen `postgres:18-alpine`, variable `PGDATA=/var/lib/postgresql/data`).
2. Restaura la última copia en él:
   ```sh
   restaurar base diaria/pj20-AAAA-MM-DD.dump "postgres://<usuario>:<clave>@ashir_pj20-asistencia-prueba-restauracion:5432/<base>"
   ```
3. Compara, desde la consola de `pj20-asistencia-api`:
   ```sh
   node dist/contar-registros.js
   node dist/contar-registros.js "postgres://…@ashir_pj20-asistencia-prueba-restauracion:5432/<base>"
   ```
   Los números deben coincidir; puede faltar lo marcado después de las 2:00 a. m.
4. **Borra el Postgres temporal.**
5. Anota la fecha de la prueba al final de este documento.

## 3. Recuperación ante un desastre

**Caso A — la base de datos se dañó o se borró:**

1. Detén `pj20-asistencia-api` para que nadie marque mientras tanto.
2. Consola del servicio de respaldos: `restaurar listar` y elige la copia más reciente.
3. `restaurar base diaria/pj20-AAAA-MM-DD.dump "$DATABASE_MIGRATION_URL"` (la URL del dueño, igual que en la API).
4. Consola de `pj20-asistencia-api`: `node dist/migrate.js` y `node dist/contar-registros.js`.
5. Inicia `pj20-asistencia-api`. Se pierde lo marcado entre la última copia y el daño.

**Caso B — se perdió el servidor completo:** monta todo de nuevo con [STAGING.md](STAGING.md) (pasos 1 a 7, con contraseñas nuevas), vuelve a crear este servicio con **la misma `RESPALDOS_CLAVE`, la misma `RESPALDOS_SAL` y el mismo permiso de Drive**, y luego:

```sh
restaurar base diaria/pj20-AAAA-MM-DD.dump "<URL del dueño de la base nueva>"
restaurar fotos
```

**Caso C — se perdieron solo las selfies:** `restaurar fotos`.

## 4. Si aparece la alerta roja en el panel

- Revisa los **logs** del servicio `pj20-asistencia-respaldos`; el último error también sale en la alerta.
- **«token expired / invalid_grant»:** el permiso de Drive venció o se revocó. Repite el paso 1.1 y reemplaza `PERMISO_DRIVE`.
- **Espacio de Drive lleno:** libera espacio o amplía el plan.
- Para forzar una copia: consola del servicio → `respaldar todo`.

## Registro de pruebas de restauración

| Fecha | Copia restaurada | Resultado | Quién |
| ----- | ---------------- | --------- | ----- |
|       |                  |           |       |
