import { CONSENT_LABEL } from '@pj20/shared/constants';
import { FileWarning } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandHeader } from '../components/brand/brand-header.js';

/**
 * Política de Tratamiento de Datos Personales (Ley 1581 de 2012 y Decreto
 * 1377 de 2013). Public page: linked from the consent screen and from the
 * Google sign-in consent screen.
 * DRAFT: company identification fields must be completed and the text
 * reviewed by BLAZAR ENERGY's legal advisor before production.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BrandHeader />

        <p className="mt-8 flex items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-[14px] font-medium text-warning">
          <FileWarning className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Borrador pendiente de revisión legal y de completar los datos de identificación de la
          empresa. No usar en producción hasta su aprobación.
        </p>

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
            <li>
              Domicilio: Av. 6 Norte # 49-06 · <Pending>ciudad</Pending>
            </li>
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
              <strong>Fotografía (selfie):</strong> tomada al marcar, donde se ven tu rostro y el
              lugar donde estás. Es un <strong>dato sensible</strong>.
            </li>
            <li>
              <strong>Dispositivo:</strong> modelo, sistema operativo, versión de la aplicación,
              dirección IP e identificador del celular autorizado.
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
            La fotografía de tu rostro es un dato sensible. Solo la tratamos con tu autorización
            expresa y solo pueden verla los administradores autorizados. De acuerdo con la ley,{' '}
            <strong>no estás obligado a autorizar el tratamiento de datos sensibles</strong>. Si no
            lo autorizas, informa al área de Talento Humano para acordar un mecanismo alternativo de
            registro de asistencia.
          </p>
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
              Las fotografías se guardan en almacenamiento privado y solo se muestran mediante
              enlaces temporales.
            </li>
            <li>Solo los administradores autorizados acceden a la información de asistencia.</li>
            <li>
              Cada acción administrativa queda registrada en un historial que no se puede alterar.
            </li>
          </ul>
        </Section>

        <Section title="8. Conservación">
          <p>
            Conservamos los datos durante la relación laboral y por el tiempo adicional que exijan
            las normas laborales y de auditoría. <Pending>plazo de conservación definitivo</Pending>
          </p>
        </Section>

        <Section title="9. Vigencia">
          <p>
            Esta política rige desde su publicación ({CONSENT_LABEL}). Cualquier cambio sustancial
            se informará en la aplicación y, cuando la ley lo exija, se solicitará una nueva
            autorización.
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

/** Visible marker for data the company still has to provide. */
function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[13px] font-semibold text-warning">
      Por completar: {children}
    </span>
  );
}
