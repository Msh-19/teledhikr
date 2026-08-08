import { config as dotenvConfig } from 'dotenv';

// Load .env only in non-production
if (process.env.NODE_ENV !== 'production') {
  dotenvConfig();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  botToken: requireEnv('BOT_TOKEN'),
  chatId: requireEnv('CHAT_ID'),
  latitude: parseFloat(requireEnv('LATITUDE')),
  longitude: parseFloat(requireEnv('LONGITUDE')),
  timezone: requireEnv('TIMEZONE'),
  prayerMethod: parseInt(process.env.PRAYER_METHOD || '4', 10),
} as const;

// Constants
export const ADHKAR_DELAY_MS = 2500;
export const PRAYER_REMINDER_WINDOW_MINUTES = 35;
export const MORNING_ADHKAR_OFFSET_MINUTES = 20; // minutes after Fajr
export const EVENING_ADHKAR_BEFORE_MAGHRIB_MINUTES = 30; // minutes before Maghrib
export const GENERAL_DHIKR_COOLDOWN_HOURS = 3;
