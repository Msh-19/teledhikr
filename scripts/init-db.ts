import pg from 'pg';
import { config as dotenvConfig } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenvConfig();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('render.com') || databaseUrl.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function initDb(): Promise<void> {
  console.log('[init-db] Creating tables...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_context (
      date DATE PRIMARY KEY,
      hijri_date TEXT NOT NULL,
      hijri_month INT NOT NULL,
      hijri_day INT NOT NULL,
      hijri_month_days INT NOT NULL DEFAULT 30,
      fajr TEXT NOT NULL,
      sunrise TEXT,
      dhuhr TEXT NOT NULL,
      asr TEXT NOT NULL,
      maghrib TEXT NOT NULL,
      isha TEXT NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE daily_context
    ADD COLUMN IF NOT EXISTS sunrise TEXT;
  `);
  console.log('[init-db] ✅ daily_context');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      active BOOLEAN DEFAULT true
    );
  `);
  console.log('[init-db] ✅ content');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS adhkar (
      id SERIAL PRIMARY KEY,
      "order" INT NOT NULL UNIQUE,
      session TEXT NOT NULL,
      arabic TEXT NOT NULL,
      translation TEXT NOT NULL,
      transliteration TEXT,
      repeat_count INT NOT NULL DEFAULT 1,
      virtue TEXT,
      source TEXT
    );
  `);
  console.log('[init-db] ✅ adhkar');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hijri_events (
      id SERIAL PRIMARY KEY,
      hijri_month INT,
      hijri_day INT,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL
    );
  `);
  console.log('[init-db] ✅ hijri_events');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sent_log (
      id SERIAL PRIMARY KEY,
      trigger_key TEXT NOT NULL,
      sent_date DATE NOT NULL,
      sent_at TIMESTAMP DEFAULT now()
    );
  `);

  // Create unique constraint for dedup (idempotent)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sent_log_trigger_date_unique'
      ) THEN
        ALTER TABLE sent_log ADD CONSTRAINT sent_log_trigger_date_unique
          UNIQUE (trigger_key, sent_date);
      END IF;
    END
    $$;
  `);

  // Create index for fast lookups (idempotent)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sent_log_key_date
      ON sent_log (trigger_key, sent_date);
  `);
  console.log('[init-db] ✅ sent_log');

  console.log('[init-db] All tables created successfully.');
}

initDb()
  .catch((err) => {
    console.error('[init-db] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
