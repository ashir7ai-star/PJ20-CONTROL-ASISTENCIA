import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '../../../components/ui/button.js';
import { Sheet } from '../../../components/ui/sheet.js';
import { formatAccuracy, formatLongDate, formatTime } from '../../../lib/format.js';
import { MapPreview, SelfiePreview } from '../components/evidence.js';
import { KindLabel, ReviewBadge } from '../components/admin-ui.js';
import { type AttendanceRecord, initials, signalLabels } from '../model.js';
import { clockSkewSeconds } from '../stats.js';

interface RecordDetailProps {
  record: AttendanceRecord | null;
  employeeName: string;
  onClose: () => void;
  onDecision?: (id: string, decision: 'approved' | 'rejected') => void;
}

/** Full evidence for one record: selfie, location, device, server checks. */
export function RecordDetail({ record, employeeName, onClose, onDecision }: RecordDetailProps) {
  if (!record) return null;
  const pending = record.review === 'pending';
  const skew = clockSkewSeconds(record);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={employeeName}
      description={`${formatLongDate(record.serverTime)} · ${formatTime(record.serverTime)}`}
      footer={
        pending && onDecision ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              onClick={() => {
                onDecision(record.id, 'rejected');
              }}
            >
              Rechazar
            </Button>
            <Button
              onClick={() => {
                onDecision(record.id, 'approved');
              }}
            >
              Aprobar
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between">
        <KindLabel kind={record.kind} className="text-[16px]" />
        <ReviewBadge review={record.review} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SelfiePreview initials={initials(employeeName)} />
        <MapPreview {...record.location} className="aspect-[3/4]" />
      </div>

      <h3 className="mt-6 text-[14px] font-semibold">Verificaciones del servidor</h3>
      <ul className="mt-2 flex flex-col gap-2 text-[14px]">
        {record.signals.length === 0 && <Check ok text="Sin señales de fraude" />}
        {record.signals.map((s) => (
          <Check key={s} ok={false} text={signalLabels[s]} />
        ))}
        <Check
          ok={record.device.verified}
          text={record.device.verified ? 'Celular verificado' : 'Celular sin verificar'}
        />
      </ul>

      <dl className="mt-6 divide-y divide-line rounded-2xl text-[14px] ring-1 ring-line">
        <Row label="Hora del servidor" value={formatTime(record.serverTime)} />
        <Row
          label="Hora del celular"
          value={
            skew === 0
              ? 'Igual a la del servidor'
              : `${String(Math.abs(skew))} s ${skew > 0 ? 'atrasada' : 'adelantada'}`
          }
        />
        <Row label="Precisión GPS" value={formatAccuracy(record.location.accuracyM)} />
        <Row label="Celular" value={`${record.device.model} · ${record.device.os}`} />
        <Row label="Aplicación" value={record.device.app} />
        <Row label="Dirección IP" value={record.ip} />
      </dl>
    </Sheet>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
      )}
      {text}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
