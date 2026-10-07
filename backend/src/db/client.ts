import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';

import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction (both expose the same query API). */
export type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export function createDatabase(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}
