# Evaluación de impacto en la privacidad · Control de Asistencia

> BLAZAR ENERGY · NIT 901.724.892-9 · Cali, Colombia · 2026-10-09
> Documento interno de responsabilidad demostrada (Ley 1581 de 2012). No es asesoría jurídica: conviene que lo revise un abogado.

## 1. Qué tratamos y para qué

| Dato                                              | Para qué                                                            | Base                                                 | Conservación                                  |
| ------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Nombre y correo de Google                         | Identificar al empleado; lista blanca de acceso                     | Autorización general (relación laboral)              | Mientras exista la cuenta                     |
| Ubicación GPS **solo al marcar** (y su precisión) | Saber desde dónde se marcó                                          | Autorización general                                 | Relación laboral + 3 años                     |
| Hora del servidor (y la del celular, informativa) | Registro de jornada y horas extras (art. 162 CST, Ley 2466 art. 12) | Obligación legal + autorización                      | Relación laboral + 3 años                     |
| IP y navegador o sistema del celular              | Antifraude y auditoría                                              | Autorización general                                 | Relación laboral + 3 años                     |
| **Selfie (rostro y lugar)**                       | Verificar que es la persona y que está en su sitio                  | **Autorización separada y opcional** (dato sensible) | **90 días**; hasta 1 año si está en revisión  |
| Decisiones de autorización y consentimientos      | Prueba de cada autorización                                         | Responsabilidad demostrada                           | Mientras se conserven los datos que respaldan |

## 2. Riesgos y medidas

| Riesgo                                     | Medida aplicada                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Usar el rostro sin una autorización válida | Autorización aparte, «no estás obligado», alternativa sin selfie y revocación en cualquier momento; historial inmutable de decisiones |
| Rastreo continuo del empleado              | La ubicación se toma solo en el instante de marcar; nunca en segundo plano                                                            |
| Acceso indebido a las fotos                | Almacenamiento privado nunca expuesto a internet; solo administradores con sesión activa; cada acceso pasa por la API                 |
| Alteración de registros laborales          | Marcaciones, consentimientos, autorizaciones y auditoría son **inmutables** en la base de datos (ni el dueño puede editarlos)         |
| Conservar datos más tiempo del necesario   | Borrado automático de selfies cada 12 horas; plazos fijados en la política                                                            |
| Suplantación (otra persona marca)          | Inicio de sesión con Google, sesiones seguras, hora del servidor; antifraude adicional en la Fase 4                                   |
| Filtración en tránsito                     | HTTPS obligatorio, HSTS, cookies `Secure` y `HttpOnly`                                                                                |
| Pedir acceso a nombre de otro              | Nombre y correo verificados por Google; comprobante de 15 minutos atado al navegador                                                  |

## 3. Derechos de los titulares

- **Canal:** nathan@ylevigroup.com.
- **Consultas:** 10 días hábiles, prorrogables 5 (Ley 1581, art. 14).
- **Reclamos:** 15 días hábiles, prorrogables 8 (art. 15).
- **Revocar la selfie:** el propio empleado, desde «Autorización de selfie» en la app.

## 4. Pendiente de la empresa

- **Registro Nacional de Bases de Datos:** solo es obligatorio si los activos totales superan 100.000 UVT (Decreto 090 de 2018). Confirmar con los estados financieros.
- **Revisión por un abogado** de la política y de este documento cuando sea posible.
