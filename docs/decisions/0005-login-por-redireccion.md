# 0005 — Inicio de sesión con Google por redirección (iPhone)

- **Estado:** aceptada · 2026-10-09 (decisión D5)
- **Reglas relacionadas:** `CLAUDE.md` §1.2, §1.4 (D1), §1.8

## Contexto

El botón de Google funcionaba en modo **popup**: se abre una ventana de Google y, al elegir la cuenta, esa ventana le entrega la credencial a la app. En Android funciona. En **iPhone**, Safari abre el popup como una pestaña aparte y su protección contra rastreo entre sitios corta el regreso: la pestaña de Google queda **en blanco** y el inicio de sesión no termina. Las cabeceras de la app (CSP, COOP) se revisaron y no lo causan.

## Decisión

Usar el modo **redirección** de Google Identity Services para todos los navegadores:

1. `POST /api/v1/auth/nonce` emite el nonce de un solo uso y además lo **ata al navegador** con la cookie `__Host-pj20_nonce` (HttpOnly, Secure, `SameSite=None`, 5 minutos).
2. La misma pestaña va a Google, que firma el nonce dentro del ID token.
3. Google envía un formulario a `POST /api/v1/auth/google/redirect`. El servidor:
   - exige que el nonce del token sea **el de la cookie** y lo consume una sola vez;
   - verifica la firma y la audiencia del token (D1) y aplica la lista blanca;
   - abre la sesión (D2) y redirige a `/`.

   Los errores vuelven como `/?acceso=no-autorizada` o `/?acceso=error`.

La dirección de regreso está registrada en Google Cloud (**Authorized redirect URIs**).

## Seguridad

- **Login CSRF:** sin la cookie, un atacante podría hacer que una víctima inicie sesión con la cuenta del atacante. La cookie solo existe en el navegador que pidió el nonce, y el nonce del token debe coincidir con ella.
- **Origen:** esa única ruta acepta el origen `https://accounts.google.com`. También acepta `null`, porque Safari puede enviarlo en ese envío entre sitios. El resto de la API sigue exigiendo el origen propio.
- La ruta mantiene el límite de intentos y responde siempre con una redirección, nunca con JSON.

## Alternativas descartadas

- **Popup solo en Android y redirección en iPhone:** dos flujos que probar y mantener, y una detección de navegador frágil.
- **Pedir a los empleados que cambien ajustes de Safari:** no es aceptable para 30 personas.

## Consecuencia

El endpoint JSON `POST /api/v1/auth/google` se conserva para el APK de Android (Fase 5), que obtendrá el ID token con el inicio de sesión nativo.
