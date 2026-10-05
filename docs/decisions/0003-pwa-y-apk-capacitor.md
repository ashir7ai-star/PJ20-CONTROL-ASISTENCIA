# ADR 0003 — PWA + APK de Android con Capacitor

- **Estado:** aceptada · 2026-10-05

## Contexto

- Requisito de negocio: impedir el fraude con apps de ubicación falsa (Fake GPS), visto en la práctica por el dueño del proyecto.
- Restricción: **costo cero**, sin tiendas de aplicaciones. El dueño prefiere PWA por su facilidad de despliegue.
- Empleados: ~30, mayoría Android, algunos iPhone (proporción exacta desconocida).

## Hechos técnicos

- La API de geolocalización del navegador **no informa** si la ubicación es simulada. Una PWA no puede detectar Fake GPS.
- Android nativo sí: `Location.isMock()` / `isFromMockProvider()`.
- Play Integrity y App Attest requieren distribuir por tiendas (costo). **Android Key Attestation** es gratuito y no requiere Play Store.

## Decisión

Una sola base de código React:

- **PWA** para iPhone y escritorio.
- **APK de Android** generado con **Capacitor** desde el mismo código, con un plugin nativo de detección de ubicación simulada y Key Attestation. Distribuido desde nuestro servidor.
- El servidor **rechaza marcaciones de empleados Android hechas desde el navegador**.

## Consecuencias

- Protección completa en Android; en iPhone la protección se apoya en selfie, dispositivo vinculado y análisis en el servidor (falsificar GPS en iPhone exige computador o jailbreak).
- La llave de firma del APK es crítica: se guarda fuera del repositorio con respaldo seguro.
- Detalle completo en `CLAUDE.md` §2B.
