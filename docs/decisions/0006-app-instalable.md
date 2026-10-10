# 0006 — App instalable (PWA) e inicio de sesión dentro de la app en iPhone

- **Estado:** aceptada · 2026-10-10 (decisión D9)
- **Reglas relacionadas:** `CLAUDE.md` §0 (PWA), §1.4 (D1, decisión 0005), §2.7 (sin conexión no se marca), §B.8 (estados), §8

## Contexto

Los empleados abren la app con un enlace. Queremos que quede en la pantalla de inicio con el ícono de BLAZAR y que abra sin la barra del navegador, en iPhone y en Android, sin tiendas de aplicaciones y sin costo.

En iPhone, la app instalada **guarda sus cookies aparte de Safari**. Con el inicio de sesión por redirección (0005), ir a `accounts.google.com` saca a la persona del alcance de la app. iOS abre Google en una hoja de Safari con **otras** cookies: la cookie del nonce no llega y la sesión queda en Safari. Es un comportamiento conocido de iOS (reportes de otros equipos, 2026).

## Decisión

1. **Manifiesto e íconos.** `manifest.webmanifest` en español (`display: standalone`, colores `#050b16`) e íconos generados desde un **símbolo vectorial** redibujado del logo (`docs/design/brand/blazar-simbolo.svg`): 192, 512 y _maskable_ para Android, 180 para iPhone, más pantallas de arranque de iPhone. Solo en la app real; el prototipo de GitHub Pages no se instala.
2. **Inicio de sesión en la app instalada en iPhone** (`navigator.standalone`):
   - El botón abre, en el mismo toque, una **ventana de la propia app** (`window.open`) hacia `GET /api/v1/auth/google/start`. Según Apple (WWDC23), esa ventana se queda dentro de la app y comparte sus cookies.
   - El servidor emite el nonce, lo ata a esa ventana con la misma cookie de 0005 y redirige a Google con OpenID Connect estándar: `response_type=id_token`, `response_mode=form_post`, `state=ventana`.
     - La dirección de regreso es la **misma ya registrada**, `/api/v1/auth/google/redirect`, y se arma solo con orígenes de `APP_ORIGINS`.
     - No hay _client secret_.
   - La ruta de regreso acepta `id_token` además de `credential`. Las validaciones son idénticas: firma, `aud`, `iss`, `exp`, `email_verified`, nonce de un solo uso atado por cookie, lista blanca y límite de intentos.
   - Con `state=ventana` el servidor envía la ventana a `/acceso-listo.html?resultado=…` en lugar de a `/`. Esa página avisa a la app por `BroadcastChannel` **solo con el resultado** (`ok`, `no-autorizada`, `error`, `cancelado`), nunca con credenciales, y se cierra. Si el aviso no llega, la app vuelve a leer la sesión al recuperar el foco.
   - En navegadores normales y en Android se mantiene 0005 sin cambios.
3. **Service worker mínimo** (`public/sw.js`):
   - Guarda solo archivos de la app: la entrada `/` (red primero), los archivos con huella (caché primero, máximo 80) e íconos.
   - **Nunca intercepta `/api`.** Sin conexión, la app abre y muestra «Sin conexión»; no marca.
   - Se activa al instante, y `sw.js` se sirve sin caché para que las versiones nuevas lleguen solas.
4. **Invitación a instalar.** Es una tarjeta en el inicio de sesión y en «Marcar», más la opción «Instalar la app» en el menú.
   - En Android, Chrome ofrece su diálogo nativo (`beforeinstallprompt`, capturado al arrancar), y la invitación instala en un toque.
   - En iPhone, la invitación muestra la guía de Safari: Compartir → Agregar a pantalla de inicio.
   - Si el enlace se abrió dentro de Instagram, Facebook u otra app, pide abrirlo primero en Safari o Chrome.
   - La tarjeta se puede cerrar y no vuelve a aparecer en ese celular.

## Seguridad

- **Login CSRF:** igual que 0005. El nonce del token debe ser el de la cookie de **esa** ventana, que es la de la app.
- **Redirección abierta:** `state` solo elige entre dos destinos propios y fijos. La dirección de regreso a Google nunca sale de la cabecera `Host` si no está en `APP_ORIGINS`.
- **Datos en el celular:** el service worker no guarda respuestas de la API, sesiones ni selfies. Una prueba automática lo verifica (`src/sw.node.test.ts`).
- La CSP agrega `manifest-src 'self'` y `worker-src 'self'`; no se agrega ningún tercero.

## Alternativas descartadas

- **Construir la dirección de Google en el navegador** después de pedir el nonce: obliga a esperar antes de abrir la ventana, y iOS solo la mantiene dentro de la app si se abre en el mismo toque. Con `/auth/google/start` la ventana se abre de inmediato.
- **Entregar la sesión por un código que la app reclama** (flujo tipo «dispositivo»): permite que un atacante haga iniciar sesión a una víctima y se quede con su sesión. Se descartó.
- **Librería de service worker (Workbox):** agrega una dependencia para unas 100 líneas que se prueban directamente.
- **Usar el PNG de 110 px para los íconos:** se veía borroso a 512 px.

## Consecuencias

- En iPhone, quien inicia sesión en Safari y luego instala la app debe iniciar sesión **una vez más** dentro de la app. La guía lo dice.
- iOS puede borrar los datos de una app web sin uso por semanas. Solo implica volver a iniciar sesión; las marcaciones están en el servidor.
- **Reversión:** publicar un `sw.js` que se desinstala y quitar el registro. El manifiesto y los íconos no afectan a nadie.
