import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('render.com') || config.databaseUrl.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Generic query helper
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

// Check if a trigger has already been sent today
export async function isSentToday(
  triggerKey: string,
  date: string
): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM sent_log WHERE trigger_key = $1 AND sent_date = $2 LIMIT 1',
    [triggerKey, date]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// Log a sent trigger
export async function logSent(
  triggerKey: string,
  date: string
): Promise<void> {
  await query(
    'INSERT INTO sent_log (trigger_key, sent_date) VALUES ($1, $2) ON CONFLICT (trigger_key, sent_date) DO NOTHING',
    [triggerKey, date]
  );
}

// Get the last sent timestamp for any trigger today
export async function getLastSentTime(
  date: string
): Promise<Date | null> {
  const result = await query(
    'SELECT sent_at FROM sent_log WHERE sent_date = $1 ORDER BY sent_at DESC LIMIT 1',
    [date]
  );
  if (result.rowCount && result.rowCount > 0) {
    return result.rows[0].sent_at;
  }
  return null;
}

// Close the pool (important for cron job exit)
export async function close(): Promise<void> {
  await pool.end();
}
