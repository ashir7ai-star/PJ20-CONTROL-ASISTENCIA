/**
 * Pending access requests (D6): approve creates (or reactivates) the employee,
 * reject closes the request. Name and e-mail were verified by Google.
 */
import type { AccessRequestDto } from '@pj20/shared';
import { useState } from 'react';

import { Avatar } from '../../components/ui/avatar.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { formatLongDate, formatTime } from '../../lib/format.js';
import { initials } from './model.js';

interface AccessRequestsSectionProps {
  requests: AccessRequestDto[];
  /** Rejects with an Error whose (Spanish) message is shown on the row. */
  onResolve: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}

export function AccessRequestsSection({ requests, onResolve }: AccessRequestsSectionProps) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="solicitudes-titulo" className="mb-8">
      <h2 id="solicitudes-titulo" className="text-[18px] font-semibold">
        Solicitudes pendientes ({requests.length})
      </h2>
      <p className="mt-1 text-[14px] text-ink-muted">
        Personas que entraron con Google y pidieron acceso. Al aprobar, podrán marcar de inmediato.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {requests.map((request) => (
          <li key={request.id}>
            <RequestCard request={request} onResolve={onResolve} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestCard({
  request,
  onResolve,
}: {
  request: AccessRequestDto;
  onResolve: AccessRequestsSectionProps['onResolve'];
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const at = new Date(request.requestedAt);

  const resolve = async (decision: 'approve' | 'reject') => {
    setBusy(decision);
    setError(null);
    try {
      await onResolve(request.id, decision);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar.');
      setBusy(null);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar initials={initials(request.name)} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{request.name}</p>
          <p className="truncate text-[13px] text-ink-muted">{request.email}</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Pidió acceso el {formatLongDate(at)} a las {formatTime(at)}
            {request.deactivatedEmployee && ' · estaba desactivado: aprobar lo reactiva'}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          variant="secondary"
          loading={busy === 'reject'}
          disabled={busy !== null}
          onClick={() => void resolve('reject')}
          aria-label={`Rechazar a ${request.name}`}
        >
          Rechazar
        </Button>
        <Button
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => void resolve('approve')}
          aria-label={`Aprobar a ${request.name}`}
        >
          Aprobar
        </Button>
      </div>
    </Card>
  );
}
