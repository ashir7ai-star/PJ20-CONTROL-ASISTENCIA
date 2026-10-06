# Fase 1 — Diseño · Plan detallado

> Estado: **plan aprobado** · en ejecución · 2026-10-05
> Reglas aplicables: `CLAUDE.md` → Regla suprema (B. Diseño) y §8 (Experiencia del empleado)

## 1. Objetivo

Definir y construir el **sistema de diseño** y un **prototipo navegable** de todas las pantallas de la versión 1, con datos de ejemplo, para que apruebes cómo se verá y se usará la app **antes** de conectar la lógica real (Fases 2–6).

El prototipo **no es desechable**: se construye con los componentes reales de la app. En las fases siguientes solo se reemplazan los datos de ejemplo por datos reales.

**No incluye:** login real, base de datos, cámara/GPS reales, mapa real (se muestra un marcador de posición).

## 2. Método: 3 puntos de aprobación

| #   | Entregable                                                                                                  | Tu decisión                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| A   | **2 direcciones visuales** aplicadas a la pantalla principal "Marcar" (capturas en celular, claro y oscuro) | Eliges una (o pides ajustes) |
| B   | **Sistema de diseño** + pantallas del **empleado**                                                          | Apruebas o pides cambios     |
| C   | Pantallas del **administrador**                                                                             | Apruebas → Fase 1 cerrada    |

No se avanza de un punto al siguiente sin tu aprobación.

## 3. Sistema de diseño

| Elemento         | Definición                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Color            | Neutros + 1 color de acento (tu marca) + semánticos (éxito, alerta, error, información). Claro y oscuro. **Contraste WCAG AA verificado con una prueba automática**                        |
| Tipografía       | Inter (alojada en nuestro servidor, sin Google Fonts: privacidad y CSP). Escala: 12 · 14 · 16 · 20 · 24 · 32 · 40. Pesos 400 / 500 / 600                                                   |
| Espaciado        | Retícula de 8 pt (4 pt para ajustes finos)                                                                                                                                                 |
| Radios y sombras | 4 niveles cada uno                                                                                                                                                                         |
| Movimiento       | 150 / 200 / 250 ms, curvas definidas, respeta "reducir movimiento"                                                                                                                         |
| Íconos           | Lucide (un solo set)                                                                                                                                                                       |
| Componentes      | Botón (4 variantes, estados de carga), tarjeta, campo, insignia de estado, avatar, skeleton, aviso (toast), diálogo, hoja inferior (móvil), pestañas, tabla, estado vacío, estado de error |
| Base técnica     | Primitivas accesibles **Radix** + Tailwind (enfoque shadcn/ui: el código queda en el proyecto, sin dependencia de una librería visual externa)                                             |

Un **catálogo** interno (`/diseno`, solo en desarrollo) muestra todos los tokens y componentes en sus estados.

## 4. Pantallas del prototipo

### Empleado (celular primero)

1. Iniciar sesión con Google
2. Consentimiento de datos (Ley 1581: ubicación, selfie, dispositivo)
3. Permisos: por qué pedimos GPS y cámara, antes de que el sistema los pida
4. **Marcar** (pantalla principal): hora en vivo, estado actual (en turno / fuera de turno), botón grande Entrada/Salida — máximo 2 toques
5. Selfie: cámara frontal con guía de encuadre
6. Confirmación: hora registrada, ubicación capturada, precisión
7. Estados de error, cada uno con instrucción clara: GPS apagado, permiso negado, sin conexión, baja precisión, **ubicación falsa detectada**, dispositivo no autorizado, sesión vencida

### Administrador (escritorio primero, usable en celular)

1. **Resumen en vivo:** presentes, ausentes, llegadas del día, alertas
2. **Marcaciones:** tabla con filtros (fecha, empleado, tipo, sospechosas)
3. **Detalle de marcación:** selfie, mapa, hora, precisión, dispositivo, señales de fraude
4. **Revisión de sospechosas:** bandeja para aprobar o marcar
5. **Empleados:** lista, alta, rol, activar/desactivar
6. **Dispositivos:** aprobar cambio de celular
7. Navegación: barra lateral en escritorio, barra inferior en celular

## 5. Cambios técnicos

- Enrutamiento: **React Router 7** (modo librería). El panel admin se carga como bloque separado (_lazy_): el celular de un empleado no descarga su código (`CLAUDE.md` §1.5).
- Dependencias nuevas (todas con la regla de ≥ 7 días publicadas): `react-router`, `@radix-ui/*` (las necesarias), `lucide-react`, `@fontsource-variable/inter`, `class-variance-authority`, `clsx`, `tailwind-merge`, `vitest-axe`.
- Datos de ejemplo tipados con los contratos de `packages/shared` (los mismos que usará la API real).

## 6. Criterios de aceptación

- [ ] Apruebas los puntos A, B y C.
- [ ] Todos los colores definidos como tokens; **ningún valor suelto** en componentes (revisado con búsqueda automática).
- [ ] Prueba automática de contraste: todos los pares texto/fondo ≥ 4.5:1 (claro y oscuro).
- [ ] Prueba automática de accesibilidad (axe) en cada pantalla: 0 violaciones.
- [ ] Áreas táctiles ≥ 44×44 px; navegación completa con teclado en el panel.
- [ ] Cada pantalla revisada en 360 px, 390 px, tablet y escritorio, claro y oscuro.
- [ ] El código del panel admin no está en el bloque que descarga un empleado (verificado en el build).
- [ ] Lighthouse ≥ 90 en la pantalla Marcar.
- [ ] lint, typecheck, pruebas, build y CI en verde.

## 7. Riesgos

| Riesgo                                                                             | Mitigación                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Rediseños tardíos encarecen las fases siguientes                                   | 3 aprobaciones escalonadas, empezando por la dirección visual      |
| Diseño "bonito" pero lento en Android de gama baja                                 | Presupuesto de peso y Lighthouse en móvil como criterio            |
| Prototipo que no refleja la realidad técnica (ej. límites de cámara/GPS en iPhone) | Los estados de error se basan en los casos reales de las Fases 3–5 |

**Reversión:** rama `feat/fase-1-diseno`; nada llega a `main` sin PR y CI en verde.

## 8. Lo que necesito de ti

1. **Aprobar este plan.**
2. **Nombre que verán los empleados** (nombre de la empresa o de la app).
3. **Logo** (SVG o PNG) y **colores de marca**, si existen. Si no, propongo una paleta sobria.

---

## 9. Registro de ejecución

### Decisiones

| Fecha      | Punto | Decisión                                                                                                                                               |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-05 | Plan  | Aprobado. Empresa: **BLAZAR ENERGY**; encabezado = logo + «Control de Asistencia»; app **100 % en español** (agregado a `CLAUDE.md` B.14 y sección C). |
| 2026-10-05 | A     | Elegida la dirección **«Pulso»** (`docs/design/fase-1-A-direcciones.png`).                                                                             |
| 2026-10-05 | B     | **Aprobado**: sistema de diseño + pantallas del empleado (`docs/design/fase-1-B-*.png`). Logo SVG: no disponible por ahora; se usa el PNG procesado.   |

### Cambios técnicos respecto al plan

- **React Router 8.4** (no 7): es la versión estable actual.
- **vitest-axe descartado** (sin mantenimiento desde 2022): se usa **axe-core** directamente (`app/src/test/a11y.ts`).
- **Logo:** el PNG original tenía fondo menta no transparente. Se generaron versiones transparentes clara y oscura conservando el antialiasing. **Pendiente: logo vectorial (SVG)** para íconos nítidos de la app.
- **Fuente:** Inter solo con el subconjunto latino (1 archivo de 48 KB en lugar de 7).
- Páginas de desarrollo (`/diseno`, `/estado`) con carga diferida: no pesan en la app del empleado.
- Guardianes automáticos nuevos: contraste WCAG de todos los tokens (claro y oscuro) y prohibición de colores sueltos en componentes, ambos con control negativo.

### Punto C — Panel del administrador (en revisión)

- Pantallas: Resumen en vivo, Marcaciones (filtros + estado vacío), Detalle (selfie, mapa, dispositivo, verificaciones del servidor), Por revisar (con explicación en español de cada señal), Empleados (alta con formulario), Celulares (aprobación de cambio de equipo). Capturas en `docs/design/fase-1-C/`.
- **Coherencia con las reglas:** una ubicación falsa en Android se **bloquea** (intento bloqueado, sin registro); solo las marcaciones aceptadas con señales dudosas van a «Por revisar» (`CLAUDE.md` §2B).
- El panel se descarga como paquete separado (20 KB gzip). **Guardián en el build** (`app/scripts/check-bundle.mjs`, con control negativo): falla si código del panel aparece en el paquete del empleado.
- Pantalla de carga con la marca para secciones diferidas (antes: pantalla en blanco al abrir el panel directamente).
- Accesibilidad: axe encontró dos menús con el mismo nombre (lateral e inferior) → corregido. Foco inicial de los paneles: el panel mismo (no el botón cerrar); en formularios, el primer campo.
- Revisión visual con emulación real de dispositivo vía protocolo DevTools (390 px y 1440 px, claro/oscuro), registrando la consola: 0 errores, 0 advertencias. El método anterior con iframes no era confiable para páginas diferidas.

### Ajuste solicitado (2026-10-05): selfie con rostro **y** lugar

- Requisito del dueño del proyecto: la foto debe mostrar el rostro y el lugar de fondo para verificar que el empleado está en su sitio de trabajo.
- Pantalla de selfie rediseñada: guía de rostro pequeña en la parte superior, marco completo con esquinas e indicación «El lugar donde estás»; instrucción «Estira el brazo y deja ver lo que hay detrás de ti».
- Consentimiento (Ley 1581) y permisos actualizados para informar que la foto incluye el lugar. Regla agregada en `CLAUDE.md` §2B.6.
- Vista previa del panel: «Selfie con el lugar».

### Ajuste (2026-10-05): el administrador puede volver a su panel desde «Marcar»

- Detectado al revisar el prototipo: un administrador que marcaba su asistencia no tenía forma de volver al panel.
- Botón «Ir al panel de administración» al pie de la pantalla Marcar, **solo para administradores** (los empleados nunca lo ven; probado). Se ubicó abajo y no junto al logo porque en celulares de 360 px se encimaría con él.

### Ajuste (2026-10-05): gestión de roles y accesos

- Solicitado por el dueño del proyecto: cambiar el rol de cada usuario (hacer o quitar administrador) y quitar usuarios.
- Menú «Acciones» por usuario: hacer administrador / quitar rol, desactivar / reactivar acceso, eliminar. Cada acción se confirma; si no está permitida, se explica el motivo.
- Reglas de seguridad (`app/src/features/admin/permissions.ts`, con pruebas; el backend aplicará las mismas):
  - Nadie puede quitarse su propio rol, desactivarse ni eliminarse.
  - Siempre debe quedar al menos un administrador activo.
  - **Eliminar** solo usuarios sin marcaciones. Con marcaciones se **desactivan**: pierden el acceso y su historial se conserva (Ley 1581 + auditoría + marcaciones inmutables, `CLAUDE.md` §2.4).
- Script `pnpm dev:movil` para probar el prototipo en celulares de la misma red wifi.
