import { config } from './config.js';
import { query } from './db.js';
import type { DailyContext } from './types.js';

interface AladhanTimings {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
}

interface AladhanResponse {
  code: number;
  status: string;
  data: {
    timings: AladhanTimings;
    date: {
      hijri: {
        date: string;
        day: string;
        month: { number: number; en: string; days: number };
        year: string;
      };
    };
  };
}

// Strip timezone suffix from Aladhan time strings like "04:15 (AST)" → "04:15"
function cleanTime(timeStr: string): string {
  return timeStr.replace(/\s*\(.*\)$/, '').trim();
}

// Convert YYYY-MM-DD to DD-MM-YYYY for Aladhan API
function toAladhanDateFormat(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

// Fetch prayer times + Hijri date from Aladhan API
async function fetchFromAladhan(date: string): Promise<DailyContext> {
  const aladhanDate = toAladhanDateFormat(date);
  const url = `https://api.aladhan.com/v1/timings/${aladhanDate}?latitude=${config.latitude}&longitude=${config.longitude}&method=${config.prayerMethod}`;

  console.log(`[aladhan] Fetching prayer times for ${date}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Aladhan API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AladhanResponse;

  if (json.code !== 200) {
    throw new Error(`Aladhan API returned code ${json.code}: ${json.status}`);
  }

  const { timings, date: dateInfo } = json.data;
  const hijri = dateInfo.hijri;

  return {
    date,
    hijriDate: hijri.date,
    hijriMonth: hijri.month.number,
    hijriDay: parseInt(hijri.day, 10),
    hijriMonthDays: hijri.month.days,
    fajr: cleanTime(timings.Fajr),
    sunrise: cleanTime(timings.Sunrise),
    dhuhr: cleanTime(timings.Dhuhr),
    asr: cleanTime(timings.Asr),
    maghrib: cleanTime(timings.Maghrib),
    isha: cleanTime(timings.Isha),
  };
}

// Get daily context — from cache (DB) or fetch from API
export async function getDailyContext(date: string): Promise<DailyContext> {
  // Check cache first
  const cached = await query(
    'SELECT * FROM daily_context WHERE date = $1',
    [date]
  );

  if (cached.rowCount && cached.rowCount > 0) {
    const row = cached.rows[0];
    return {
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
      hijriDate: row.hijri_date,
      hijriMonth: row.hijri_month,
      hijriDay: row.hijri_day,
      hijriMonthDays: row.hijri_month_days,
      fajr: row.fajr,
      sunrise: row.sunrise || '06:17',
      dhuhr: row.dhuhr,
      asr: row.asr,
      maghrib: row.maghrib,
      isha: row.isha,
    };
  }

  // Fetch from API and cache
  const context = await fetchFromAladhan(date);

  await query(
    `INSERT INTO daily_context (date, hijri_date, hijri_month, hijri_day, hijri_month_days, fajr, sunrise, dhuhr, asr, maghrib, isha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (date) DO NOTHING`,
    [
      context.date,
      context.hijriDate,
      context.hijriMonth,
      context.hijriDay,
      context.hijriMonthDays,
      context.fajr,
      context.sunrise,
      context.dhuhr,
      context.asr,
      context.maghrib,
      context.isha,
    ]
  );

  console.log(`[aladhan] Cached context for ${date}: Hijri ${context.hijriDate}, Fajr=${context.fajr}, Maghrib=${context.maghrib}`);
  return context;
}
