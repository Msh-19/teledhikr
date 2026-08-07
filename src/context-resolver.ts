import { query, getLastSentTime } from './db.js';
import {
  config,
  PRAYER_REMINDER_WINDOW_MINUTES,
  MORNING_ADHKAR_OFFSET_MINUTES,
  EVENING_ADHKAR_BEFORE_MAGHRIB_MINUTES,
  GENERAL_DHIKR_COOLDOWN_HOURS,
} from './config.js';
import type { DailyContext, Trigger, AdhkarRow, ContentRow, HijriEvent } from './types.js';

// Parse HH:MM string to total minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Get current time as minutes since midnight in the configured timezone
function nowMinutes(now: Date): number {
  // Format current time in the configured timezone
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: config.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return timeToMinutes(timeStr);
}

// Get day of week (0=Sunday, 5=Friday, etc.) in configured timezone
function getDayOfWeek(now: Date): number {
  const dayStr = now.toLocaleDateString('en-US', {
    timeZone: config.timezone,
    weekday: 'short',
  });
  const days: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return days[dayStr] ?? 0;
}

// Compute tomorrow's Hijri day/month given today's context
function getTomorrowHijri(ctx: DailyContext): { hijriMonth: number; hijriDay: number } {
  if (ctx.hijriDay < ctx.hijriMonthDays) {
    return { hijriMonth: ctx.hijriMonth, hijriDay: ctx.hijriDay + 1 };
  }
  // Last day of Hijri month — roll over
  const nextMonth = ctx.hijriMonth === 12 ? 1 : ctx.hijriMonth + 1;
  return { hijriMonth: nextMonth, hijriDay: 1 };
}

// Check if current time is within a window [start, start + windowMinutes)
function isInWindow(currentMinutes: number, anchorTime: string, offsetMinutes: number, windowMinutes: number): boolean {
  const anchor = timeToMinutes(anchorTime) + offsetMinutes;
  return currentMinutes >= anchor && currentMinutes < anchor + windowMinutes;
}

// Check if current time is within [startTime, endTime)
function isBetween(currentMinutes: number, startTime: string, endTime: string, startOffset = 0): boolean {
  const start = timeToMinutes(startTime) + startOffset;
  const end = timeToMinutes(endTime);
  return currentMinutes >= start && currentMinutes < end;
}

export async function resolveTriggers(
  todayCtx: DailyContext,
  tomorrowCtx: DailyContext,
  now: Date
): Promise<Trigger[]> {
  const triggers: Trigger[] = [];
  const current = nowMinutes(now);
  const dayOfWeek = getDayOfWeek(now);
  const tomorrowHijri = getTomorrowHijri(todayCtx);

  // 1. Morning Adhkar — between Fajr+20min and Dhuhr
  if (isBetween(current, todayCtx.fajr, todayCtx.dhuhr, MORNING_ADHKAR_OFFSET_MINUTES)) {
    const rows = await query<AdhkarRow>(
      `SELECT id, "order", session, arabic, translation, transliteration,
              repeat_count AS "repeatCount", virtue, source
       FROM adhkar
       WHERE session IN ('morning', 'both')
       ORDER BY "order"`
    );
    if (rows.rowCount && rows.rowCount > 0) {
      triggers.push({
        key: 'adhkar_morning',
        kind: 'adhkar_morning',
        payload: rows.rows,
      });
    }
  }

  // 2. Evening Adhkar — between Maghrib-30min and Isha
  if (isBetween(current, todayCtx.maghrib, todayCtx.isha, -EVENING_ADHKAR_BEFORE_MAGHRIB_MINUTES)) {
    const rows = await query<AdhkarRow>(
      `SELECT id, "order", session, arabic, translation, transliteration,
              repeat_count AS "repeatCount", virtue, source
       FROM adhkar
       WHERE session IN ('evening', 'both')
       ORDER BY "order"`
    );
    if (rows.rowCount && rows.rowCount > 0) {
      triggers.push({
        key: 'adhkar_evening',
        kind: 'adhkar_evening',
        payload: rows.rows,
      });
    }
  }

  // 3. Jummah — Friday between 10:00 and 12:00 local time
  if (dayOfWeek === 5 && current >= timeToMinutes('10:00') && current < timeToMinutes('12:00')) {
    const rows = await query<ContentRow>(
      `SELECT id, category, text FROM content
       WHERE category = 'jummah' AND active = true
       ORDER BY RANDOM() LIMIT 1`
    );
    if (rows.rowCount && rows.rowCount > 0) {
      triggers.push({
        key: 'jummah',
        kind: 'jummah',
        payload: rows.rows[0],
      });
    }
  }

  // 4. Hijri significant day events — after Fajr+20min, once per event per day
  const hijriEvents = await query<HijriEvent>(
    `SELECT id, hijri_month AS "hijriMonth", hijri_day AS "hijriDay",
            label, category, message
     FROM hijri_events
     WHERE category = 'hijri_event'
       AND (hijri_month = $1 OR hijri_month IS NULL)
       AND (hijri_day = $2 OR hijri_day IS NULL)`,
    [todayCtx.hijriMonth, todayCtx.hijriDay]
  );

  if (current >= timeToMinutes(todayCtx.fajr) + MORNING_ADHKAR_OFFSET_MINUTES) {
    for (const event of hijriEvents.rows) {
      // For events with NULL hijri_month, they match every month (e.g. Ayyam al-Beedh)
      // For events with NULL hijri_day, they match every day in that month (e.g. last 10 nights)
      const matchesMonth = event.hijriMonth === null || event.hijriMonth === todayCtx.hijriMonth;
      const matchesDay = event.hijriDay === null || event.hijriDay === todayCtx.hijriDay;
      if (matchesMonth && matchesDay) {
        const key = `hijri_event:${event.label.toLowerCase().replace(/\s+/g, '_')}`;
        triggers.push({
          key,
          kind: 'hijri_event',
          payload: event,
        });
      }
    }
  }

  // 5. Fasting reminders — sent the EVENING BEFORE (after Maghrib)
  const maghribMinutes = timeToMinutes(todayCtx.maghrib);
  if (current >= maghribMinutes) {
    // Check tomorrow's Hijri date against fasting events
    const fastingEvents = await query<HijriEvent>(
      `SELECT id, hijri_month AS "hijriMonth", hijri_day AS "hijriDay",
              label, category, message
       FROM hijri_events
       WHERE category = 'fasting'
         AND (hijri_month = $1 OR hijri_month IS NULL)
         AND (hijri_day = $2 OR hijri_day IS NULL)`,
      [tomorrowHijri.hijriMonth, tomorrowHijri.hijriDay]
    );

    for (const event of fastingEvents.rows) {
      const matchesMonth = event.hijriMonth === null || event.hijriMonth === tomorrowHijri.hijriMonth;
      const matchesDay = event.hijriDay === null || event.hijriDay === tomorrowHijri.hijriDay;
      if (matchesMonth && matchesDay) {
        const key = `fasting:${event.label.toLowerCase().replace(/\s+/g, '_')}`;
        triggers.push({
          key,
          kind: 'fasting',
          payload: event,
        });
      }
    }

    // Weekly Monday/Thursday fasting reminder
    // Sunday evening → Monday fast, Wednesday evening → Thursday fast
    const tomorrowDay = (dayOfWeek + 1) % 7;
    if (tomorrowDay === 1 || tomorrowDay === 4) {
      const dayName = tomorrowDay === 1 ? 'Monday' : 'Thursday';
      triggers.push({
        key: `fasting:weekly_${dayName.toLowerCase()}`,
        kind: 'fasting',
        payload: `🌙 Reminder: Tomorrow is ${dayName} — a day the Prophet ﷺ used to fast.\n\n"The Prophet ﷺ used to fast on Mondays and Thursdays." — (Tirmidhi)\n\nMake your intention tonight if you wish to fast, in shaa Allah.`,
      });
    }
  }

  // 6. Prayer reminders — within 15 min after each prayer
  const prayers: Array<{ name: string; time: string }> = [
    { name: 'fajr', time: todayCtx.fajr },
    { name: 'dhuhr', time: todayCtx.dhuhr },
    { name: 'asr', time: todayCtx.asr },
    { name: 'maghrib', time: todayCtx.maghrib },
    { name: 'isha', time: todayCtx.isha },
  ];

  for (const prayer of prayers) {
    if (isInWindow(current, prayer.time, 0, PRAYER_REMINDER_WINDOW_MINUTES)) {
      const rows = await query<ContentRow>(
        `SELECT id, category, text FROM content
         WHERE category = 'general_dhikr' AND active = true
         ORDER BY RANDOM() LIMIT 1`
      );
      if (rows.rowCount && rows.rowCount > 0) {
        triggers.push({
          key: `prayer_reminder:${prayer.name}`,
          kind: 'prayer_reminder',
          payload: rows.rows[0],
        });
      }
    }
  }

  // 7. General dhikr fallback — if no other triggers and cooldown passed
  if (triggers.length === 0) {
    // Check if enough time has passed since last send
    const lastSent = await getLastSentTime(todayCtx.date);
    const cooldownMs = GENERAL_DHIKR_COOLDOWN_HOURS * 60 * 60 * 1000;

    // Only send during reasonable hours (after Fajr, before Isha+30)
    const afterFajr = current >= timeToMinutes(todayCtx.fajr);
    const beforeLateNight = current <= timeToMinutes(todayCtx.isha) + 30;

    if (afterFajr && beforeLateNight) {
      const shouldSend = !lastSent || (now.getTime() - lastSent.getTime() > cooldownMs);
      if (shouldSend) {
        const rows = await query<ContentRow>(
          `SELECT id, category, text FROM content
           WHERE category = 'general_dhikr' AND active = true
             AND id NOT IN (
               SELECT CAST(SPLIT_PART(trigger_key, ':', 2) AS INT) FROM sent_log
               WHERE trigger_key LIKE 'general_dhikr:%' AND sent_date = $1
             )
           ORDER BY RANDOM() LIMIT 1`,
          [todayCtx.date]
        );
        if (rows.rowCount && rows.rowCount > 0) {
          triggers.push({
            key: `general_dhikr:${rows.rows[0].id}`,
            kind: 'general_dhikr',
            payload: rows.rows[0],
          });
        }
      }
    }
  }

  return triggers;
}
