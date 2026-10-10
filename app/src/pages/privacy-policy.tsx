import { CONSENT_LABEL } from '@pj20/shared/constants';
import type { ReactNode } from 'react';

import { BrandHeader } from '../components/brand/brand-header.js';

/**
 * Política de Tratamiento de Datos Personales (Ley 1581 de 2012 y Decreto
 * 1377 de 2013). Public page: linked from the consent screen and from the
 * Google sign-in consent screen.
 * Final text (D7, 2026-10-09): sensitive-data authorization apart from the
 * general one, an alternative without selfie, and the retention periods the
 * app actually enforces. Legal sources: docs/phases/D7-CUMPLIMIENTO-LEGAL.md.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="safe-area min-h-dvh bg-surface text-ink">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BrandHeader />

        <h1 className="mt-8 text-[28px] font-semibold tracking-tight">
          Política de Tratamiento de Datos Personales
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Aplicación «Control de Asistencia» · {CONSENT_LABEL}
        </p>

        <Section title="1. Responsable del tratamiento">
          <ul>
            <li>Razón social: BLAZAR ENERGY</li>
            <li>NIT: 901.724.892-9</li>
            <li>Domicilio: Av. 6 Norte # 49-06, Cali, Valle del Cauca, Colombia</li>
            <li>
              Correo para asuntos de datos personales:{' '}
              <a
                href="mailto:nathan@ylevigroup.com"
                className="font-medium text-link underline underline-offset-2"
              >
                nathan@ylevigroup.com
              </a>
            </li>
          </ul>
        </Section>

        <Section title="2. Datos que tratamos">
          <ul>
            <li>
              <strong>Identificación:</strong> nombre y correo de la cuenta de Google con la que
              inicias sesión.
            </li>
            <li>
              <strong>Ubicación (GPS):</strong> solo en el instante en que marcas entrada o salida,
              con su margen de precisión. <strong>No rastreamos tu ubicación</strong> en ningún otro
              momento.
            </li>
            <li>
              <strong>Fotografía (selfie), opcional:</strong> tomada al marcar, donde se ven tu
              rostro y el lugar donde estás. Es un <strong>dato sensible</strong> y solo la tomamos
              si la autorizas aparte (punto 4).
            </li>
            <li>
              <strong>Dispositivo:</strong> tipo de navegador o aplicación, sistema operativo y
              dirección IP desde la que marcas.
            </li>
            <li>
              <strong>Registros de asistencia:</strong> hora de entrada y salida, asignada por el
              servidor.
            </li>
          </ul>
        </Section>

        <Section title="3. Para qué los usamos">
          <ul>
            <li>Registrar y controlar la asistencia y la jornada laboral.</li>
            <li>Verificar que quien marca eres tú y que estás en tu sitio de trabajo.</li>
            <li>Prevenir el fraude en las marcaciones (por ejemplo, ubicaciones falsas).</li>
            <li>Cumplir obligaciones laborales y atender auditorías.</li>
          </ul>
          <p>
            No vendemos tus datos, no los usamos con fines publicitarios y no los compartimos con
            terceros, salvo obligación legal o requerimiento de autoridad competente.
          </p>
        </Section>

        <Section title="4. Datos sensibles">
          <p>
            La fotografía de tu rostro es un dato sensible (artículo 5 de la Ley 1581 de 2012). Por
            eso te pedimos una <strong>autorización separada</strong> de la general, y solo pueden
            verla los administradores autorizados. De acuerdo con la ley,{' '}
            <strong>no estás obligado a autorizar el tratamiento de datos sensibles</strong>.
          </p>
          <ul>
            <li>
              <strong>Si no la autorizas:</strong> marcas solo con tu ubicación y la hora del
              servidor. Tus marcaciones aparecen como «sin selfie» para el administrador, que podrá
              verificar tu asistencia por otros medios. No afecta tu relación laboral.
            </li>
            <li>
              <strong>Puedes cambiar de decisión cuando quieras</strong> desde el menú de tu cuenta
              → «Autorización de selfie». Guardamos la fecha de cada decisión como prueba.
            </li>
          </ul>
          <p></p>
        </Section>

        <Section title="5. Tus derechos">
          <ul>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Solicitar prueba de la autorización que otorgaste.</li>
            <li>Ser informado sobre el uso que se ha dado a tus datos.</li>
            <li>
              Revocar la autorización o solicitar la supresión de tus datos, cuando no exista un
              deber legal o contractual de conservarlos.
            </li>
            <li>Acceder gratuitamente a tus datos.</li>
            <li>
              Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) una vez
              agotado el trámite de consulta o reclamo ante nosotros.
            </li>
          </ul>
        </Section>

        <Section title="6. Consultas y reclamos">
          <p>
            Escríbenos al correo indicado en el punto 1. Las <strong>consultas</strong> se responden
            en un máximo de <strong>10 días hábiles</strong> (prorrogables 5 días hábiles) y los{' '}
            <strong>reclamos</strong> en un máximo de <strong>15 días hábiles</strong> (prorrogables
            8 días hábiles), conforme a los artículos 14 y 15 de la Ley 1581 de 2012.
          </p>
        </Section>

        <Section title="7. Seguridad">
          <ul>
            <li>Toda la información viaja cifrada (HTTPS).</li>
            <li>
              Las fotografías se guardan en un almacenamiento privado que nunca se expone a internet
              y solo se muestran a administradores con sesión activa.
            </li>
            <li>Solo los administradores autorizados acceden a la información de asistencia.</li>
            <li>
              Cada acción administrativa queda registrada en un historial que no se puede alterar.
            </li>
            <li>
              Hacemos <strong>copias de seguridad diarias cifradas</strong> fuera del servidor para
              no perder los registros. Solo se usan para recuperar la información ante una falla.
            </li>
            <li>
              Usamos proveedores de nube (el servidor de la aplicación y el almacenamiento de las
              copias) que actúan como <strong>encargados del tratamiento</strong>: guardan la
              información por cuenta de BLAZAR ENERGY y no pueden usarla para otros fines. Sus
              servidores pueden estar fuera de Colombia.
            </li>
          </ul>
        </Section>

        <Section title="8. Conservación">
          <p>Conservamos cada dato solo el tiempo necesario para su finalidad:</p>
          <ul>
            <li>
              <strong>Registros de asistencia</strong> (hora, tipo y ubicación): durante la relación
              laboral y <strong>3 años después</strong> de terminada, porque son soporte del
              registro de jornada y horas extras (artículo 162 del Código Sustantivo del Trabajo,
              modificado por la Ley 2466 de 2025) y las acciones laborales prescriben en 3 años
              (artículo 488 del mismo código).
            </li>
            <li>
              <strong>Selfies:</strong> <strong>90 días</strong> desde la marcación y luego se
              borran automáticamente. Si la marcación está en revisión, se conservan hasta
              resolverla, con un máximo de 1 año.
            </li>
            <li>
              <strong>Solicitudes de acceso</strong> ya atendidas: 30 días.
            </li>
            <li>
              <strong>Copias de seguridad:</strong> las diarias, 35 días; las mensuales, 12 meses.
              Las selfies de las copias se borran al mismo tiempo que las originales.
            </li>
            <li>
              <strong>Autorizaciones y consentimientos:</strong> mientras se conserven los datos que
              respaldan, como prueba de que los otorgaste.
            </li>
          </ul>
        </Section>

        <Section title="9. Vigencia">
          <p>
            Esta política rige desde el 9 de octubre de 2026 ({CONSENT_LABEL}). Cualquier cambio
            sustancial se informará en la aplicación y, cuando la ley lo exija, se solicitará una
            nueva autorización.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 text-[15px] leading-relaxed [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
