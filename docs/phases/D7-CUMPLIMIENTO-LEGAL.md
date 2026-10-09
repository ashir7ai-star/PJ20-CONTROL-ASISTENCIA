# D7 — Cumplimiento legal antes del uso real · Plan detallado

> Estado: ✅ **cerrado** · 2026-10-09 (publicado y datos de prueba reiniciados)
> Reglas aplicables: `CLAUDE.md` §3 (Privacidad), §2B.6 (Selfie), §9 (Método)
> **Aviso:** investigación técnica sobre normas públicas vigentes a octubre de 2026, **no asesoría jurídica**. Se recomienda que un abogado la revise cuando sea posible.

## 1. Qué exige la ley (hallazgos)

| Norma                                                                  | Qué exige                                                                                                                                                                                                         | Efecto en la app                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Ley 2466 de 2025, art. 12** (modifica el art. 162 CST)               | El empleador **debe llevar un registro** del trabajo suplementario de cada trabajador (nombre, actividad, horas, si son diurnas o nocturnas) y **entregarle** la relación de horas extras si la pide.             | Las marcaciones son ese soporte: deben conservarse.                         |
| **Ley 2466 de 2025, art. 11** (art. 161 CST)                           | Jornada máxima de **42 horas** a la semana (cronograma de la Ley 2101 de 2021).                                                                                                                                   | Relevante para el cálculo de horas (Fase 6).                                |
| **Art. 488 CST y art. 151 CPTSS**                                      | Las acciones laborales prescriben en **3 años** desde que la obligación es exigible.                                                                                                                              | Conservar marcaciones 3 años después de terminada la relación laboral.      |
| **Ley 1581 de 2012, arts. 5 y 6**                                      | La foto que identifica el rostro es un **dato sensible**: requiere autorización **previa, expresa e informada**.                                                                                                  | La selfie necesita una autorización propia.                                 |
| **Decreto 1377 de 2013, art. 6** (DUR 1074 de 2015)                    | Se debe informar al titular que, por tratarse de datos sensibles, **no está obligado a autorizar** su tratamiento.                                                                                                | Hoy no lo decimos: hay que decirlo.                                         |
| **Decreto 1377 de 2013, art. 11**                                      | Los datos se conservan solo el tiempo **razonable y necesario** para su finalidad; luego se **suprimen**.                                                                                                         | Plazos definidos y borrado automático de selfies.                           |
| **SIC, Res. 52185 de 2025** y criterios sobre biometría                | Los datos biométricos no pueden ser el **único** medio: hay que ofrecer una **alternativa** a quien no autoriza. Atender la supresión cuando se pide. La autorización de biometría no va en una cláusula general. | Hace falta una **forma de marcar sin selfie**.                              |
| **SIC, Guía sobre fotografías como datos personales** (agosto de 2026) | Las fotos que permiten identificar a una persona son datos personales sujetos a la Ley 1581.                                                                                                                      | Confirma el tratamiento de las selfies como dato personal sensible.         |
| **Ley 1581, arts. 14 y 15**                                            | Consultas: 10 días hábiles (prorrogables 5). Reclamos: 15 días hábiles (prorrogables 8).                                                                                                                          | Plazos que deben figurar en la política.                                    |
| **Decreto 090 de 2018** (RNBD)                                         | Inscribir las bases de datos en el Registro Nacional solo si los **activos totales superan 100.000 UVT**.                                                                                                         | **No aplica:** los activos no superan el umbral (confirmado el 2026-10-09). |

## 2. Cambios propuestos

1. **Dos autorizaciones separadas en el consentimiento:**
   - **Uso de la app** (identificación, ubicación al marcar, dispositivo, hora): necesaria para el control de asistencia de la relación laboral.
   - **Selfie (dato sensible), aparte y opcional,** con el texto «No estás obligado a autorizar el tratamiento de datos sensibles».
2. **Alternativa sin selfie.** Quien no autorice la selfie marca **solo con ubicación y hora del servidor**. Su marcación queda señalada «sin selfie (alternativa)» para el administrador, que podrá verificarla por otros medios. La persona puede cambiar su decisión cuando quiera desde el menú de su cuenta.
3. **Plazos de conservación, aplicados de verdad:**
   - **Marcaciones** (hora, tipo, ubicación): durante la relación laboral y **3 años después** de terminada (art. 488 CST, Ley 2466 art. 12).
   - **Selfies:** **90 días** desde la marcación, y se borran automáticamente. Si la marcación está para revisión, se conserva hasta que se resuelva, como máximo 1 año.
   - **Solicitudes de acceso atendidas:** 30 días (ya implementado).
4. **Política final** sin el aviso de borrador, con:
   - domicilio en Cali;
   - autorización separada de la selfie y su alternativa;
   - plazos de conservación;
   - plazos de consultas y reclamos;
   - derecho a revocar la autorización de la selfie;
   - nota sobre el RNBD.
5. **Evaluación de impacto de privacidad** (documento interno breve en `docs/legal/`): qué se trata, riesgos y medidas.

## 3. Impacto en el antifraude

La selfie deja de ser obligatoria para quien no la autorice. Es una **exigencia legal**, no una elección técnica. Para mitigarlo:

- la marcación sin selfie queda **marcada y visible** para el administrador;
- el GPS, la hora del servidor y, desde la Fase 4, el celular vinculado siguen siendo obligatorios.

## 4. Pruebas

- Autorización por separado.
- Marcar sin selfie cuando no se autorizó.
- Revocar la autorización.
- Borrado automático a los 90 días.
- La política muestra los plazos.

## 5. Orden de salida a uso real

1. Aprobar D7.
2. Implementar y publicar.
3. Reiniciar los datos de prueba.
4. Primer consentimiento: el del administrador.
5. Registrar a los empleados.

## Fuentes

- Ley 2466 de 2025 (compilación de la Cancillería): https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_2466_2025.htm
- Art. 488 CST: https://leyes.co/codigo_sustantivo_del_trabajo/488.htm
- Decreto 1377 de 2013 (Función Pública): https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646
- SIC, biometría en conjuntos residenciales (Res. 52185 de 2025): https://sedeelectronica.sic.gov.co/comunicado/la-superintendencia-de-industria-y-comercio-ordena-un-conjunto-residencial-habilitar-mecanismos-de-ingreso-que-no-impliquen-el-tratamiento
- SIC, guía sobre fotografías como datos personales (2026): https://www.asuntoslegales.com.co/actualidad/sic-publico-la-guia-para-el-tratamiento-adecuado-de-las-fotografias-como-datos-personales-3101600
- Biometría en control de asistencia (alternativas, supresión): https://www.buk.co/blog/datos-biometricos-control-asistencia-colombia
- RNBD y Decreto 090 de 2018: https://www2.deloitte.com/content/dam/Deloitte/co/Documents/legal/Registro-Nacional-de-Bases-de-Datos-2025.pdf
