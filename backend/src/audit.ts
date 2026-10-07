/**
 * Immutable audit trail (CLAUDE.md §2.5). Always written inside the same
 * transaction as the change it describes: either both persist or neither.
 */
import type { Executor } from './db/client.js';
import { auditLog } from './db/schema.js';

export interface AuditActor {
  id: string | null;
  name: string | null;
}

export interface AuditContext {
  actor: AuditActor;
  requestId?: string | undefined;
  ip?: string | undefined;
}

export const SYSTEM_ACTOR: AuditActor = { id: null, name: 'Sistema' };

export async function audit(
  db: Executor,
  context: AuditContext,
  entry: {
    action: string;
    targetType: string;
    targetId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: context.actor.id,
    actorName: context.actor.name,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    requestId: context.requestId ?? null,
    ip: context.ip ?? null,
  });
}
