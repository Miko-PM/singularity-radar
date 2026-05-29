import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const res = await (pool.query as any)(text, params) as pg.QueryResult;
  const elapsed = Date.now() - start;
  if (elapsed > 1000) {
    console.warn(`[DB] Slow query (${elapsed}ms):`, text.slice(0, 80));
  }
  return res;
}

export async function runSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('[DB] Schema applied');
}

export async function runSeed() {
  const sql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  await pool.query(sql);
  console.log('[DB] Seed data inserted');
}

/** 在事务中执行一组数据库操作 */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
