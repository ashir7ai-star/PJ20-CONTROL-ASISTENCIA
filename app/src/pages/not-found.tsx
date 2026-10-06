import { Link } from 'react-router';

import { BrandHeader } from '../components/brand/brand-header.js';

export function NotFoundPage() {
  return (
    <div className="bg-pulse grid min-h-dvh place-items-center px-6 text-center text-ink">
      <div>
        <BrandHeader />
        <h1 className="mt-10 text-[26px] font-semibold tracking-tight">Página no encontrada</h1>
        <p className="mt-2 text-[15px] text-ink-muted">La dirección que abriste no existe.</p>
        <Link
          to="/"
          className="mt-6 inline-block font-medium text-link underline underline-offset-2"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
