# PJ20 — Control de Asistencia: Reglas del proyecto

Aplicación empresarial para registrar entradas y salidas de empleados con **hora exacta y ubicación GPS**.
Los empleados inician sesión con su cuenta de Google desde el celular; los administradores ven reportes en un panel web.

Estas reglas son obligatorias para todo el código (backend y frontend). Si una tarea las contradice, se detiene y se consulta antes de continuar.

---

## ★ Regla suprema — Estándar de nivel mundial

Esta aplicación se construye al nivel de las mejores empresas de tecnología del mundo (Apple, Microsoft, Meta, Tesla). **Cada línea de código, cada pantalla y cada decisión se evalúa con esta pregunta: ¿esto pasaría la revisión de un equipo senior de Apple o Microsoft?** Si la respuesta es no, no se entrega. No hay soluciones "temporales", atajos ni "después lo arreglamos". Todo trabajo sigue el **método de la sección 9: planear → verificar → construir → verificar**.

### A. Ingeniería (backend y frontend)

1. Código limpio, legible y consistente: funciones pequeñas con una sola responsabilidad, nombres precisos, sin código muerto ni duplicado.
2. Manejo de errores completo: todo caso de fallo está previsto (sin red, GPS negado, sesión vencida, servidor caído) y tiene una respuesta clara para el usuario.
3. Observabilidad: logs estructurados (JSON) con ID de petición, sin datos sensibles. Cualquier error en producción debe poder rastrearse.
4. API documentada con OpenAPI y contratos tipados compartidos entre backend y frontend.
5. Rendimiento: respuestas de la API < 300 ms en operaciones normales; consultas con índices adecuados; sin consultas N+1.
6. Las decisiones técnicas importantes se documentan en `docs/decisions/` (qué se decidió, por qué y qué alternativas se descartaron).
7. **Definición de "terminado":** funciona, tiene pruebas, pasa lint/typecheck/CI, maneja errores, es seguro, se ve impecable en celular y escritorio, y está documentado. Si falta algo, no está terminado.

### B. Diseño (UI/UX)

1. **Limpio y minimalista:** mucho espacio en blanco, jerarquía visual clara, solo lo esencial en cada pantalla. Cero saturación, cero elementos decorativos sin propósito.
2. **Sistema de diseño propio con tokens** (colores, tipografía, espaciado, radios, sombras) definidos en un solo lugar. Prohibido usar valores sueltos en los componentes.
3. **Paleta sobria:** neutros + un color de acento + colores semánticos (éxito, alerta, error). Nada de colores chillones ni degradados innecesarios.
4. **Tipografía profesional** (Inter o fuente del sistema), escala tipográfica definida, máximo 2–3 pesos.
5. **Retícula de 8 pt** para todo espaciado y alineación. Todo alineado al píxel.
6. **Modo claro y modo oscuro** desde el inicio.
7. **Componentes consistentes** construidos sobre primitivas accesibles (Radix / shadcn/ui + Tailwind) y un solo set de íconos (Lucide).
8. **Todos los estados diseñados:** cargando (skeletons, no spinners genéricos), vacío, error, éxito y sin conexión. Nunca una pantalla en blanco ni un mensaje técnico.
9. **Movimiento sutil y con propósito:** transiciones de 150–250 ms, respetando `prefers-reduced-motion`.
10. **Mobile-first:** la app del empleado se diseña primero para celular; el panel administrativo se ve impecable en escritorio y es usable en tablet/celular.
11. **Accesibilidad WCAG 2.1 AA:** contraste mínimo 4.5:1, áreas táctiles de al menos 44×44 px, navegación por teclado y etiquetas para lectores de pantalla.
12. **Rendimiento percibido:** Lighthouse ≥ 90 en Rendimiento, Accesibilidad y Buenas prácticas; la app del empleado carga en menos de 2 s en 4G. (SEO no aplica: la app es interna y está bloqueada a buscadores a propósito con `robots.txt` y `noindex`, por privacidad.)
13. **Textos cuidados:** español claro, breve y humano. Sin jerga técnica, sin "lorem ipsum", sin textos de relleno.
14. **Aplicación 100% en español:** toda la interfaz, mensajes de error, correos, notificaciones, exportaciones y formatos (fechas, horas y números con `es-CO`, zona `America/Bogota`). Ningún texto en inglés visible para usuarios. El código fuente sí va en inglés (§4.3).

### C. Marca BLAZAR ENERGY

1. La app pertenece a **BLAZAR ENERGY**. Encabezado de la app: **logo arriba y, justo debajo, "Control de Asistencia"**.
2. Colores oficiales (extraídos del logo): azul marino `#0A1F3C`, verde `#10B981`, azul cielo `#0EA5E9`.
3. Accesibilidad de la marca: texto blanco sobre `#10B981` o `#0EA5E9` **no cumple** AA. Usar texto azul marino sobre verde, o verde profundo `#047857` con texto blanco.
4. Logos: `app/src/assets/brand/logo-light.png` (fondos claros) y `logo-dark.png` (fondos oscuros, letras blancas). Original en `docs/design/brand/`. Símbolo vectorial redibujado (`docs/design/brand/blazar-simbolo.svg`, D9) para los íconos de la app; pendiente el SVG oficial del logo completo.
5. Dirección visual aprobada: **"Pulso"** (reloj protagonista + botón circular que retoma el anillo del logo). Ver `docs/design/`.

---

## 0. Stack acordado

| Capa                              | Tecnología                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend                           | Node.js LTS + TypeScript (strict) + Fastify, API REST `/api/v1`                                                                                                                                |
| Base de datos                     | PostgreSQL (migraciones versionadas con Drizzle o Prisma)                                                                                                                                      |
| Caché / sesiones / rate limit     | Redis                                                                                                                                                                                          |
| App (empleados y administradores) | **Una sola app** React + Vite + TypeScript, instalable como **PWA**. En Android se empaqueta además como **APK con Capacitor** (mismo código) para detectar ubicaciones falsas de forma nativa |
| Fotos (selfies)                   | Almacenamiento de objetos privado compatible con S3 (RustFS en Easypanel)                                                                                                                      |
| Autenticación                     | Google OAuth 2.0 / OpenID Connect (Gmail y correos corporativos, solo lista blanca)                                                                                                            |
| Integridad del dispositivo        | Android Key Attestation (gratis, no requiere Play Store)                                                                                                                                       |

**Costo cero:** no se usan servicios pagos ni tiendas de aplicaciones. Todo corre en la infraestructura existente (Hostinger + Easypanel + GitHub).
| Infraestructura | Docker → GitHub → Easypanel (VPS Hostinger) |
| CI | GitHub Actions |

---

## 1. Seguridad (no negociable)

1. **Cero secretos en el código.** Claves, contraseñas y tokens solo en variables de entorno (Easypanel). `.env` nunca se sube a Git; se mantiene un `.env.example` sin valores reales.
2. **Login solo con Google.** El backend verifica el ID token de Google (firma, `aud`, `iss`, `exp`, `email_verified`). No existen contraseñas propias.
3. **Lista blanca.** Solo entran correos registrados y activos en la tabla de empleados. Un correo de Google válido pero no registrado es rechazado.
4. **Sesiones seguras del lado del servidor** (decisión D2, Fase 2): token aleatorio de 256 bits en cookie `httpOnly`, `Secure`, `SameSite=Strict`; en la BD solo se guarda su hash. Empleado: 30 días con renovación por uso; administrador: 12 horas sin renovación. Cerrar sesión o desactivar a un empleado la invalida **al instante**. (En el APK, el mismo token viaja en `Authorization` y se guarda en el almacén seguro de Android.)
   - **Inicio de sesión (D1):** ID token de Google verificado en el servidor con _nonce_ de un solo uso, atado al navegador por cookie; botón de Google en modo redirección para que funcione en iPhone (decisión 0005). No se usa ni se guarda el _client secret_.
5. **Autorización en el backend, siempre.** Roles: `employee`, `admin`. Todo endpoint verifica rol y propiedad del dato. Denegar por defecto. Que el frontend oculte botones no es seguridad.
   - **Empleado:** al iniciar sesión solo ve la pantalla de **marcar** (entrada/salida con selfie y ubicación).
   - **Administrador:** ve la pantalla de marcar **y** el panel administrativo completo (asistencias, mapa, selfies, alertas de fraude, empleados, reportes).
   - El código del panel administrativo se carga solo para administradores, y cada endpoint `/admin` lo rechaza para cualquier otro rol.
6. **Validar toda entrada** en el backend con esquemas (zod). Nunca confiar en el cliente.
7. **SQL solo parametrizado** (ORM/query builder). Prohibido concatenar strings en consultas.
8. **HTTPS obligatorio** (además, el GPS del navegador solo funciona en HTTPS). Cabeceras de seguridad (helmet, HSTS, CSP), CORS restringido al dominio propio.
9. **Rate limiting** con Redis en login y en marcaciones.
10. **Errores sin detalles internos** hacia el cliente: nada de stack traces ni mensajes de base de datos.
11. **Postgres y Redis nunca expuestos a internet.** Solo accesibles por la red interna de Easypanel. Redis con contraseña. El usuario de BD de la app no es superusuario.
12. **Dependencias controladas:** lockfile en el repo, `npm audit` en CI, Dependabot activo. No agregar librerías sin justificación.
13. **Respaldos diarios** de Postgres fuera del VPS, con restauración probada periódicamente.

## 2. Integridad de las marcaciones (núcleo del negocio)

1. **La hora la pone el servidor.** La hora del celular se guarda solo como dato informativo; nunca se usa para cálculos.
2. **Fechas en UTC** (`timestamptz`) en la base de datos; se muestran en `America/Bogota`.
3. Cada marcación guarda: empleado, tipo (entrada/salida), hora del servidor, hora del dispositivo, latitud, longitud, precisión GPS (m), IP y dispositivo. **No hay sedes ni geocercas en la versión 1**: se registra la ubicación exacta desde donde se marcó y el administrador la ve en un mapa.
4. **Las marcaciones son inmutables.** Nunca se editan ni se borran (se refuerza con permisos/trigger en la BD). Una corrección es un **registro de ajuste nuevo** con motivo, autor y referencia a la marcación original.
5. **Auditoría:** toda acción administrativa (crear/desactivar empleado, ajustar marcación, cambiar sede) queda en `audit_log` con quién, qué, cuándo y valores antes/después.
6. **Reglas de consistencia en el backend:** no se permite entrada sobre entrada ni salida sin entrada. Si no hay ubicación, no se marca. Marcaciones con precisión GPS baja (margen mayor a 100 m) se aceptan pero quedan **marcadas para revisión**.
7. **Sin conexión no se marca** (versión 1). Así se garantiza que la hora siempre sea la del servidor.

## 2B. Antifraude (ubicación falsa, suplantación, dispositivos manipulados)

Prohibido confiar en lo que reporta el celular. La defensa es por capas y **la decisión final siempre la toma el servidor**.

1. **Android marca solo desde el APK.** El servidor rechaza marcaciones de empleados Android hechas desde el navegador. El APK detecta ubicación simulada con `Location.isMock()` / `isFromMockProvider()`: si es simulada → **la marcación se bloquea** y se registra un evento de fraude.
2. **Opciones de desarrollador / app de ubicación simulada:** el APK detecta si están activas y lo reporta al servidor. Si hay ubicación simulada configurada → bloqueo.
3. **Integridad del dispositivo y de la app (Android):** cada marcación se firma con una llave guardada en el hardware del celular (Android Keystore) y su certificado de Key Attestation se verifica **en el servidor**: confirma que es nuestra app original y que el celular no está rooteado/desbloqueado. Si falla → bloqueo.
4. **Dispositivo vinculado:** cada empleado tiene un solo celular registrado (llave del Keystore en Android; passkey/WebAuthn en iPhone). Cambiar de celular requiere aprobación del administrador.
   4b. **iPhone (PWA):** el navegador no informa si la ubicación es simulada; la protección se apoya en las capas 4, 5 y 6. Falsificar ubicación en iPhone requiere un computador o jailbreak, mucho más difícil que Fake GPS en Android.
5. **Análisis en el servidor (señales de sospecha):**
   - Velocidad imposible entre marcaciones (ej. 200 km en 10 min).
   - Coordenadas idénticas repetidas o con precisión/altitud "demasiado perfecta".
   - País/ciudad de la IP incompatible con el GPS.
   - Ubicación muy antigua (timestamp del fix GPS con más de 30 s).
     Las marcaciones sospechosas se guardan **marcadas** y aparecen en una bandeja de revisión del administrador.
6. **Selfie con autorización propia (D7).** Es un dato sensible (Ley 1581 arts. 5–6): se pide **aparte** de la autorización general, informando que **no es obligatoria** (Decreto 1377 art. 6), y el empleado puede revocarla cuando quiera. Quien no la autoriza marca **solo con GPS y hora del servidor** y su marcación queda señalada «sin selfie» (alternativa exigida por la SIC, Res. 52185 de 2025). Quien la autoriza la toma en cada marcación, **en vivo con la cámara frontal** dentro de la app (prohibido elegir de la galería). **Debe mostrar el rostro y el lugar de fondo** (encuadre amplio, brazo estirado) para que el administrador verifique que el empleado está en su sitio de trabajo. Se guarda en almacenamiento privado que nunca se expone a internet; solo la ven administradores con sesión válida, a través de la API, que la verifica en cada petición (decisión 0004). Se borra a los 90 días (hasta 1 año si la marcación está en revisión).
7. **Ninguna capa es infalible por sí sola.** Toda nueva técnica de fraude detectada se documenta y se agrega como capa adicional.

## 3. Privacidad (Ley 1581 de 2012 — Habeas Data, Colombia)

1. La ubicación se captura **solo en el momento de marcar**. Prohibido el rastreo continuo.
2. **Consentimiento informado** en el primer ingreso, guardado con fecha y versión del texto aceptado. Cubre ubicación, hora e información del dispositivo; la **selfie lleva una autorización separada y opcional**, con historial inmutable de cada decisión (D7). Acceso a las fotos restringido a administradores.
   - **Conservación (D7):** marcaciones durante la relación laboral + 3 años (art. 488 CST, Ley 2466 art. 12); selfies 90 días con borrado automático; solicitudes de acceso atendidas 30 días.
3. Recolectar el mínimo dato necesario y definir un tiempo de retención.
4. Los logs nunca contienen tokens, cookies ni datos personales innecesarios.

## 4. Arquitectura y código

1. Monorepo: `backend/`, `app/` (React + PWA, con el proyecto Android de Capacitor dentro), `packages/shared/` (tipos y contratos compartidos), `docs/`, `docker-compose.yml` para desarrollo local.
2. TypeScript `strict` en ambos lados. Prohibido `any` salvo justificación comentada.
3. **Código en inglés** (variables, funciones, tablas, endpoints). **Textos de la interfaz en español.**
4. ESLint + Prettier obligatorios; el código que no pasa lint no se integra.
5. Configuración leída de variables de entorno y **validada al arrancar**: si falta una, la app no inicia.
6. Cambios de BD solo mediante **migraciones versionadas**. Nunca modificar la BD de producción a mano.
7. Formato de error único en la API: `{ error: { code, message } }`.
8. Lógica de negocio (cálculo de horas, reglas de marcación, precisión GPS) separada de las rutas, en funciones puras y testeables.

## 5. Calidad y pruebas

1. Pruebas unitarias obligatorias para la lógica de negocio (horas trabajadas, reglas de marcación, precisión GPS, permisos).
2. Pruebas de integración de endpoints contra una BD de prueba en Docker.
3. GitHub Actions en cada PR: lint → typecheck → tests → build. Si algo falla, no se integra.

## 6. Git

1. `main` = producción. Se trabaja en ramas (`feat/...`, `fix/...`) y se integra por Pull Request, solo con CI en verde. (El plan gratuito de GitHub no permite bloquear `main` en repos privados, así que esta regla se cumple por disciplina: nunca se hace push directo a `main`.)
2. Commits con formato Conventional Commits (`feat:`, `fix:`, `chore:`…).
3. Nunca se suben `.env`, dumps de BD, llaves ni credenciales. Si ocurre por error, la credencial se rota de inmediato.
4. Repositorio **privado**.

## 7. Despliegue

1. Imágenes Docker multi-stage, ejecutadas con usuario **no root**.
2. Entornos separados en Easypanel: **staging** y **producción**, cada uno con su propia BD y sus propios secretos.
3. Endpoint `/api/health` para monitoreo. Todas las rutas del backend viven bajo `/api` (Easypanel enruta `/api` al backend y el resto a la PWA).
4. Las migraciones se ejecutan de forma controlada en cada despliegue; nunca se despliega con CI fallando.
5. La PWA se sirve desde el mismo dominio que la API (Easypanel), no desde GitHub Pages.
6. El APK de Android se firma con una llave de la empresa guardada fuera del repositorio (con respaldo seguro: si se pierde, no se pueden publicar actualizaciones). Se descarga desde nuestro propio servidor y la app avisa cuando hay una versión nueva; el servidor puede exigir una versión mínima.

## 8. Experiencia del empleado

1. Marcar en **máximo 2 toques** después de abrir la app.
2. Confirmación clara: hora registrada y ubicación capturada.
3. Si el GPS está apagado o el permiso fue negado, explicar cómo activarlo.
4. Debe funcionar bien en celulares Android de gama baja y en conexiones lentas.

## 9. ★ Método de trabajo: planear → verificar → construir → verificar

Regla obligatoria, al mismo nivel que la regla suprema. **Nunca se escribe código sin un plan aprobado, y nunca se entrega nada sin verificarlo.**

### Antes de desarrollar

1. **Investigar primero:** leer el código existente, `docs/PLAN.md` y las decisiones en `docs/decisions/`. Nunca suponer cómo funciona algo: comprobarlo.
2. **Plan escrito y estructurado** para cada fase o tarea relevante, con:
   - Objetivo y criterios de aceptación (cómo sabremos que está bien).
   - Archivos, tablas y endpoints que se crean o modifican.
   - Impacto en lo que ya existe y riesgos (qué se podría romper).
   - Plan de pruebas (automáticas y manuales).
   - Plan de reversión si algo sale mal.
3. **Aprobación del dueño del proyecto** antes de implementar. No se agregan funciones no acordadas.

### Durante el desarrollo

4. Pasos pequeños y verificables; cada paso deja el sistema funcionando.
5. Las pruebas se escriben junto con el código, no después.
6. Si aparece algo no previsto en el plan, se detiene, se informa y se ajusta el plan.

### Después de desarrollar (verificación obligatoria)

7. Ejecutar lint, typecheck, pruebas y build. Todo debe pasar.
8. **Probar la funcionalidad real** (levantar la app, recorrer el flujo en celular y escritorio), no solo las pruebas automáticas.
9. **Revisar regresiones:** confirmar que lo que ya funcionaba sigue funcionando.
10. Autorrevisión contra estas reglas (seguridad, antifraude, diseño, privacidad, Definición de terminado).
11. **Informe honesto:** qué se hizo, cómo se verificó, qué falló y qué queda pendiente. Nunca se reporta como terminado algo que no se verificó.
12. Actualizar `docs/PLAN.md` con el estado real de la fase.
