# D9 — App instalable (iPhone y Android) · Plan detallado

> Estado: 🧪 **construido, pendiente de prueba en celulares reales** · 2026-10-10 (aprobado por el dueño el mismo día) · decisión [0006](../decisions/0006-app-instalable.md)
> Reglas aplicables: `CLAUDE.md` §B (diseño), §C (marca), §1.4 (sesiones), §2.7 (sin conexión no se marca), §8 (experiencia del empleado), §9 (método)

## 1. Objetivo

Que el empleado tenga **el ícono de BLAZAR en la pantalla de inicio** y que la app abra como una app propia: pantalla completa, sin barra del navegador y con la sesión ya iniciada. Debe funcionar igual de bien en **iPhone (Safari)** y en **Android (Chrome)**. Sigue costando cero, sin tiendas de aplicaciones.

## 2. El punto delicado: iniciar sesión con Google dentro de la app instalada en iPhone

En iPhone, la app instalada guarda sus cookies **aparte de Safari**. Al tocar «Continuar con Google», el inicio de sesión de hoy sale de la app hacia `accounts.google.com`. iOS lo abre en una hoja de Safari que **no comparte las cookies** con la app instalada. Google termina bien, pero la sesión queda en Safari y la app sigue pidiendo iniciar sesión. Es un comportamiento conocido de iOS, documentado por otros equipos en 2026.

**Solución (solo en iPhone con la app instalada):**

1. Al tocar el botón, la app abre de inmediato una **ventana interna propia** (`window.open`). Según Apple (WWDC23), esa ventana se queda dentro de la app instalada y comparte sus cookies.
2. Esa ventana va a Google con el flujo estándar OpenID Connect: `response_type=id_token`, `response_mode=form_post` y el mismo _nonce_ de un solo uso de hoy (D1). Se usa la misma dirección de regreso ya registrada en Google: `/api/v1/auth/google/redirect`.
   - No cambia nada en Google Cloud.
   - No hay _client secret_.
   - El servidor verifica lo mismo que hoy: firma, `aud`, `iss`, `exp`, `email_verified`, _nonce_ y lista blanca.
3. El servidor crea la sesión en la cookie de la app instalada y dirige la ventana a una página mínima, «Listo». Esa página avisa a la app con un mensaje **sin datos** (`BroadcastChannel`) y se cierra.
4. La app recibe el aviso, consulta `/me` y entra.

En Android, en el computador y en Safari normal se mantiene el flujo actual (D5), que ya funciona.

> **Compuerta:** antes de construir el resto se hace una **prueba corta en un iPhone real**. Primero se instala la app sin cambios para confirmar que el problema existe; después se prueba la ventana interna. Si iOS se comporta distinto a lo documentado, se detiene y se ajusta este plan (§9.6).

## 3. Qué se construye

### 3.1 Ícono y datos de la app

- **`manifest.webmanifest`:**
  - nombre «Control de Asistencia · BLAZAR ENERGY» y nombre corto «Asistencia»;
  - `lang: es-CO`, `display: standalone`, `start_url: /` y `scope: /`;
  - colores `#050b16`, igual al tema oscuro, para que no haya destello blanco al abrir;
  - `id` fijo, para que futuras actualizaciones no creen un segundo ícono.
- **Íconos** generados desde el logo PNG actual sobre fondo azul marino:
  - 192 y 512 px;
  - **maskable** (con margen seguro, para que Android no recorte el anillo);
  - `apple-touch-icon` de 180 px.
- **Pantallas de arranque de iPhone:** fondo `#050b16` con el logo, por tamaño de pantalla.
- **Etiquetas de iOS:** `apple-mobile-web-app-capable`, título «Asistencia» y barra de estado `black-translucent`. Se revisan los márgenes seguros (notch y barra inferior) en todas las pantallas.

### 3.2 Service worker mínimo y seguro

- Guarda **solo los archivos estáticos de la app** (HTML, JS y CSS con huella, íconos), para que abra rápido aun con señal débil.
- **Nunca guarda nada de `/api`.** Sin conexión no se marca (§2.7): las marcaciones y la sesión siempre van al servidor.
- Sin conexión, la app abre y muestra la pantalla «Sin conexión» que ya existe, no la página de error del navegador.
- **Actualizaciones:** cuando se publica una versión nueva, la app la toma sola en la siguiente apertura. Nadie queda atrapado en una versión vieja.

### 3.3 Invitación a instalar

- Una tarjeta discreta en la pantalla principal: **«Instala la app en tu celular»**. Se puede cerrar y no vuelve a molestar, y no aparece si la app ya está instalada.
  - **Android:** un botón «Instalar» abre el diálogo nativo de Chrome.
  - **iPhone:** instrucciones ilustradas de 2 pasos: _Compartir_ → _Agregar a pantalla de inicio_. Si el empleado abrió el enlace desde WhatsApp o Gmail, se le indica abrirlo primero en Safari.
- El mismo contenido queda en el menú, en la opción «Instalar la app».

### 3.4 Servidor web (nginx) y seguridad

- La CSP agrega `manifest-src 'self'` y `worker-src 'self'`, y permite que la ventana interna vaya a `accounts.google.com` (`form-action`).
- `sw.js` y el manifiesto se sirven **sin caché**, para que las actualizaciones lleguen.
- El endpoint de regreso acepta también el campo `id_token` del flujo estándar, además del `credential` de GIS. Mismas validaciones, mismo límite de intentos.

## 4. Archivos

| Archivo                                                                      | Cambio                                                    |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| `app/public/manifest.webmanifest`, `app/public/icons/*`                      | Nuevos                                                    |
| `app/index.html`                                                             | Manifiesto, íconos y etiquetas de iOS                     |
| `app/src/sw.ts` (o `public/sw.js`) + registro en `main.tsx`                  | Nuevo service worker, solo en el build real               |
| `app/src/auth/google-button.tsx` + `app/src/auth/ios-standalone-login.ts`    | Ventana interna en iPhone instalado                       |
| `app/src/features/employee/install-prompt.tsx`                               | Tarjeta e instrucciones de instalación                    |
| `app/src/components/ui/theme-menu.tsx`                                       | Opción «Instalar la app»                                  |
| `app/nginx.conf`                                                             | CSP y caché del service worker                            |
| `backend/src/routes/v1.ts`                                                   | Acepta `id_token`; página «Listo» para la ventana interna |
| `app/scripts/check-bundle.mjs`                                               | Verifica que el service worker nunca incluya rutas `/api` |
| `docs/decisions/0006-app-instalable.md`, `docs/deploy/GUIA-EMPLEADO.md` (§1) | Decisión y paso a paso de instalación                     |

No hay migraciones ni cambios en la base de datos.

## 5. Pruebas

**Automáticas:**

- El manifiesto es válido e incluye los íconos requeridos.
- El service worker no intercepta `/api` (prueba unitaria de la regla de caché).
- Login con `id_token` en el endpoint de regreso: válido, _nonce_ incorrecto, _nonce_ reutilizado y correo no autorizado (integración).
- Tarjeta de instalación: aparece, se cierra, no aparece si ya está instalada, y muestra las instrucciones correctas por sistema (axe incluido).
- Lighthouse: la app es instalable.

**Manuales, en celulares reales (obligatorias):**

| Paso                                                   | iPhone | Android |
| ------------------------------------------------------ | :----: | :-----: |
| Instalar desde el enlace; el ícono BLAZAR se ve nítido |   ☐    |    ☐    |
| Abre a pantalla completa, sin barra del navegador      |   ☐    |    ☐    |
| Iniciar sesión con Google **dentro** de la app         |   ☐    |    ☐    |
| La sesión sigue al cerrar y volver a abrir la app      |   ☐    |    ☐    |
| Permiso de GPS y marcación correcta                    |   ☐    |    ☐    |
| Cámara frontal y selfie (quien la autorizó)            |   ☐    |    ☐    |
| Panel de administrador dentro de la app                |   ☐    |    ☐    |
| Sin conexión: muestra «Sin conexión» y no marca        |   ☐    |    ☐    |
| Al publicar una versión nueva, la app se actualiza     |   ☐    |    ☐    |
| Cerrar sesión funciona                                 |   ☐    |    ☐    |

## 6. Criterios de aceptación

- [ ] Ícono BLAZAR en la pantalla de inicio de iPhone y Android; abre sin barra del navegador.
- [ ] Inicio de sesión con Google completo **dentro** de la app instalada en ambos.
- [ ] GPS, cámara, marcación y panel funcionan igual que en el navegador.
- [ ] Ninguna respuesta de `/api` queda guardada en el celular; sin conexión no se marca.
- [ ] Las versiones nuevas llegan solas.
- [ ] Lint, typecheck, pruebas, build y CI en verde.

## 7. Riesgos

| Riesgo                                                    | Mitigación                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| iOS cambia el manejo de la ventana interna                | Compuerta con iPhone real antes de construir; quien use Safari sin instalar sigue entrando como hoy |
| El service worker deja a alguien en una versión vieja     | `sw.js` sin caché, activación inmediata y prueba manual de actualización                            |
| Un error de caché guarda datos personales                 | Regla «nunca `/api`», con prueba automática y verificación en el build                              |
| Empleados que abren el enlace desde WhatsApp (sin Safari) | La tarjeta lo detecta y explica cómo abrirlo en Safari                                              |
| iOS borra los datos de apps web sin uso por semanas       | Solo cuesta volver a iniciar sesión; las marcaciones están en el servidor                           |

**Reversión:** quitar el registro del service worker y publicar una versión con un `sw.js` que se desinstala solo. El manifiesto y los íconos no afectan a nadie. El endpoint sigue aceptando el flujo actual.

## 8. Informe de ejecución (2026-10-10)

**Construido**, con dos ajustes respecto del plan, ambos más simples y seguros:

- **La dirección de Google la arma el servidor.** La ventana abre `GET /api/v1/auth/google/start`, que emite el nonce y redirige a Google. Así la ventana se abre en el mismo toque, sin esperar al nonce, y iOS la mantiene dentro de la app.
- **La regla «nunca `/api`» la verifica una prueba unitaria del service worker** (`src/sw.node.test.ts`), no `check-bundle.mjs`.

**Además:**

- **Símbolo vectorial del logo.** El PNG del logo mide 110 px y se veía borroso como ícono, así que el símbolo se redibujó en SVG, medido sobre el original: `docs/design/brand/blazar-simbolo.svg`. De él salen los íconos y 10 pantallas de arranque de iPhone (de SE a 17 Pro Max).
- **Márgenes seguros del iPhone.** Las hojas inferiores, el pie del consentimiento y la política de privacidad respetan la barra de inicio y la muesca cuando la app ocupa toda la pantalla.

**Verificado:**

- **Pruebas automáticas:**
  - servidor: 47 unitarias y 62 de integración, 6 nuevas del flujo de la ventana (nonce atado, reutilizado, de otro navegador, cuenta no autorizada, cancelación, `Host` ajeno);
  - app: 304, entre ellas la ventana en iPhone, la invitación por sistema, accesibilidad axe y el service worker.
- **Imagen Docker real con nginx:**
  - el manifiesto sale con su tipo correcto y `sw.js` sin caché;
  - Chrome no reporta **ningún error de instalabilidad**;
  - el service worker guarda solo archivos de la app, ninguna ruta `/api`;
  - **sin conexión**, la app abre y muestra «Sin conexión a internet».
- **Capturas de la invitación y de la guía de iPhone** en tema oscuro y claro.

**Pendiente (lo hace el dueño, con su iPhone y su Android):** la tabla de pruebas manuales de la sección 5, en especial el inicio de sesión **dentro** de la app instalada en iPhone. Es la compuerta de la sección 2: si iOS no se comporta como lo documenta Apple, se ajusta.
