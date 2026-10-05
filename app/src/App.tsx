import type { DependencyName, HealthResponse } from '@pj20/shared';
import { dependencyNames } from '@pj20/shared';
import { useEffect, useState } from 'react';

import { fetchHealth } from './api/health.js';

type State =
  { kind: 'loading' } | { kind: 'ready'; health: HealthResponse } | { kind: 'unreachable' };

const dependencyLabels: Record<DependencyName, string> = {
  database: 'Base de datos',
  cache: 'Caché',
  storage: 'Almacenamiento',
};

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Incrementing this re-runs the effect; each run cancels the previous request.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      (health) => {
        setState({ kind: 'ready', health });
      },
      () => {
        if (!controller.signal.aborted) setState({ kind: 'unreachable' });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section
        aria-labelledby="title"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">PJ20</p>
        <h1 id="title" className="mt-1 text-xl font-semibold tracking-tight">
          Control de Asistencia
        </h1>

        <div className="mt-6" aria-live="polite" aria-busy={state.kind === 'loading'}>
          <Summary state={state} />
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {dependencyNames.map((name) => (
              <li key={name} className="flex items-center justify-between py-3 text-sm">
                <span>{dependencyLabels[name]}</span>
                <DependencyBadge state={state} name={name} />
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={retry}
          disabled={state.kind === 'loading'}
          className="mt-6 h-11 w-full rounded-xl bg-ink text-sm font-medium text-canvas transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          Verificar de nuevo
        </button>
      </section>
    </main>
  );
}

function Summary({ state }: { state: State }) {
  if (state.kind === 'loading') {
    return <p className="text-sm text-ink-muted">Verificando el sistema…</p>;
  }
  if (state.kind === 'unreachable') {
    return (
      <p className="text-sm font-medium text-danger">
        No hay conexión con el servidor. Revisa tu conexión e intenta de nuevo.
      </p>
    );
  }
  return state.health.status === 'ok' ? (
    <p className="text-sm font-medium text-success">Todos los servicios están operativos.</p>
  ) : (
    <p className="text-sm font-medium text-warning">Algunos servicios no están disponibles.</p>
  );
}

function DependencyBadge({ state, name }: { state: State; name: DependencyName }) {
  if (state.kind === 'loading') {
    return <span className="h-4 w-20 animate-pulse rounded-full bg-line" aria-hidden="true" />;
  }
  const up = state.kind === 'ready' && state.health.checks[name] === 'up';
  return (
    <span className={`flex items-center gap-2 font-medium ${up ? 'text-success' : 'text-danger'}`}>
      <span
        className={`size-2 rounded-full ${up ? 'bg-success' : 'bg-danger'}`}
        aria-hidden="true"
      />
      {up ? 'Operativo' : 'Sin servicio'}
    </span>
  );
}
