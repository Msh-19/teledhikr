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

interface AdhkarEntry {
  order: number;
  content: string;
  translation?: string;
  transliteration?: string;
  count: number;
  fadl: string;
  source: string;
  type: number; // 0=both, 1=morning, 2=evening
}

const TYPE_MAP: Record<number, string> = {
  0: 'both',
  1: 'morning',
  2: 'evening',
};

async function seedAdhkar(): Promise<void> {
  console.log('[seed-adhkar] Fetching adhkar data from GitHub...');

  const [enRes, arRes] = await Promise.all([
    fetch('https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/main/en.json'),
    fetch('https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/main/ar.json'),
  ]);

  if (!enRes.ok || !arRes.ok) {
    throw new Error(`Failed to fetch adhkar data: en=${enRes.status}, ar=${arRes.status}`);
  }

  const enData: AdhkarEntry[] = await enRes.json() as AdhkarEntry[];
  const arData: AdhkarEntry[] = await arRes.json() as AdhkarEntry[];

  console.log(`[seed-adhkar] Fetched ${enData.length} English entries, ${arData.length} Arabic entries`);

  // Build lookup by order
  const arMap = new Map<number, AdhkarEntry>();
  for (const entry of arData) {
    arMap.set(entry.order, entry);
  }

  let inserted = 0;
  for (const en of enData) {
    const ar = arMap.get(en.order);
    if (!ar) {
      console.warn(`[seed-adhkar] No Arabic entry for order ${en.order}, skipping`);
      continue;
    }

    const session = TYPE_MAP[en.type] || 'both';

    await pool.query(
      `INSERT INTO adhkar ("order", session, arabic, translation, transliteration, repeat_count, virtue, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("order") DO UPDATE SET
         session = EXCLUDED.session,
         arabic = EXCLUDED.arabic,
         translation = EXCLUDED.translation,
         transliteration = EXCLUDED.transliteration,
         repeat_count = EXCLUDED.repeat_count,
         virtue = EXCLUDED.virtue,
         source = EXCLUDED.source`,
      [
        en.order,
        session,
        ar.content,         // Arabic text from ar.json
        en.translation || en.content, // English translation from en.json
        en.transliteration || '',
        en.count || 1,
        en.fadl || '',       // English virtue text
        en.source || '',
      ]
    );
    inserted++;
  }

  console.log(`[seed-adhkar] ✅ Inserted/updated ${inserted} adhkar entries`);
}

seedAdhkar()
  .catch((err) => {
    console.error('[seed-adhkar] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
