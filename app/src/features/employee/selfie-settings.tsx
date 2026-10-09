/**
 * "Autorización de selfie" (D7): the employee grants or revokes the sensitive
 * photo at any time. The server keeps every decision as immutable proof.
 */
import type { Me } from '@pj20/shared';
import { useState } from 'react';

import { api, ApiRequestError } from '../../api/client.js';
import { Button } from '../../components/ui/button.js';
import { Sheet } from '../../components/ui/sheet.js';

interface SelfieSettingsProps {
  authorized: boolean;
  open: boolean;
  onClose: () => void;
  onChanged: (me: Me) => void;
}

export function SelfieSettings({ authorized, open, onClose, onChanged }: SelfieSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async () => {
    setSaving(true);
    setError(null);
    try {
      const me = await api<Me>('/me/selfie-authorization', {
        method: 'PUT',
        body: { authorized: !authorized },
      });
      onChanged(me);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError && failure.code !== 'NETWORK_ERROR'
          ? failure.message
          : 'No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      variant="center"
      title="Autorización de selfie"
      description={
        authorized
          ? 'Hoy autorizas la selfie: al marcar, tomas una foto de tu rostro y del lugar.'
          : 'Hoy no autorizas la selfie: marcas solo con tu ubicación y la hora.'
      }
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={authorized ? 'danger' : 'primary'}
            loading={saving}
            onClick={() => void change()}
          >
            {authorized ? 'Retirar autorización' : 'Autorizar selfie'}
          </Button>
        </div>
      }
    >
      <p className="text-[15px] leading-relaxed">
        La selfie es un dato sensible y es opcional: no estás obligado a autorizarla. Puedes cambiar
        tu decisión cuando quieras; queda registrada con fecha.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger"
        >
          {error}
        </p>
      )}
    </Sheet>
  );
}
