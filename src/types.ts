// Daily context cached from Aladhan API
export interface DailyContext {
  date: string; // YYYY-MM-DD
  hijriDate: string; // e.g. '10-01-1448'
  hijriMonth: number;
  hijriDay: number;
  hijriMonthDays: number; // total days in the Hijri month (29 or 30)
  fajr: string; // HH:MM
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

// Adhkar row from database
export interface AdhkarRow {
  id: number;
  order: number;
  session: 'morning' | 'evening' | 'both';
  arabic: string;
  translation: string;
  transliteration: string;
  repeatCount: number;
  virtue: string;
  source: string;
}

// Content bank row
export interface ContentRow {
  id: number;
  category: 'general_dhikr' | 'jummah' | 'hijri_event' | 'fasting';
  text: string;
}

// Hijri event row
export interface HijriEvent {
  id: number;
  hijriMonth: number | null;
  hijriDay: number | null;
  label: string;
  category: 'hijri_event' | 'fasting';
  message: string;
}

// Trigger result from context resolver
export type TriggerKind =
  | 'adhkar_morning'
  | 'adhkar_evening'
  | 'jummah'
  | 'hijri_event'
  | 'fasting'
  | 'prayer_reminder'
  | 'general_dhikr';

export interface Trigger {
  key: string; // unique key for sent_log dedup, e.g. 'adhkar_morning', 'hijri_event:ashura'
  kind: TriggerKind;
  payload: AdhkarRow[] | ContentRow | HijriEvent | string;
}
