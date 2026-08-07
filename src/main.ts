import { toZonedTime, format } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { config } from './config.js';
import { getDailyContext } from './aladhan.js';
import { resolveTriggers } from './context-resolver.js';
import { isSentToday, logSent, close } from './db.js';
import {
  sendMessage,
  sendAdhkarSequence,
  formatContent,
  formatHijriEvent,
  formatPrayerReminder,
} from './telegram.js';
import type { AdhkarRow, ContentRow, HijriEvent } from './types.js';

async function main(): Promise<void> {
  console.log('[main] TeleDhikr cron run starting...');
  const now = new Date();
  const zonedNow = toZonedTime(now, config.timezone);

  // Get today's and tomorrow's date strings in YYYY-MM-DD
  const today = format(zonedNow, 'yyyy-MM-dd', { timeZone: config.timezone });
  const tomorrow = format(addDays(zonedNow, 1), 'yyyy-MM-dd', { timeZone: config.timezone });

  console.log(`[main] Today: ${today}, Timezone: ${config.timezone}`);

  // Fetch/cache daily context for today and tomorrow
  const todayCtx = await getDailyContext(today);
  const tomorrowCtx = await getDailyContext(tomorrow);

  console.log(`[main] Hijri: ${todayCtx.hijriDate} (month=${todayCtx.hijriMonth}, day=${todayCtx.hijriDay})`);
  console.log(`[main] Prayer times: Fajr=${todayCtx.fajr}, Dhuhr=${todayCtx.dhuhr}, Asr=${todayCtx.asr}, Maghrib=${todayCtx.maghrib}, Isha=${todayCtx.isha}`);

  // Resolve what triggers are due right now
  const triggers = await resolveTriggers(todayCtx, tomorrowCtx, now);
  console.log(`[main] Resolved ${triggers.length} trigger(s): ${triggers.map(t => t.key).join(', ') || '(none)'}`);

  // Process each trigger
  for (const trigger of triggers) {
    // Dedup check
    const alreadySent = await isSentToday(trigger.key, today);
    if (alreadySent) {
      console.log(`[main] Skipping ${trigger.key} — already sent today`);
      continue;
    }

    console.log(`[main] Processing trigger: ${trigger.key}`);

    try {
      switch (trigger.kind) {
        case 'adhkar_morning':
          await sendAdhkarSequence(trigger.payload as AdhkarRow[], 'morning');
          break;

        case 'adhkar_evening':
          await sendAdhkarSequence(trigger.payload as AdhkarRow[], 'evening');
          break;

        case 'jummah': {
          const content = trigger.payload as ContentRow;
          await sendMessage(
            `🕌 <b>Jummah Mubarak!</b>\n\n${content.text}`
          );
          break;
        }

        case 'hijri_event': {
          const event = trigger.payload as HijriEvent;
          await sendMessage(formatHijriEvent(event));
          break;
        }

        case 'fasting': {
          if (typeof trigger.payload === 'string') {
            await sendMessage(trigger.payload);
          } else {
            const event = trigger.payload as HijriEvent;
            await sendMessage(formatHijriEvent(event));
          }
          break;
        }

        case 'prayer_reminder': {
          const content = trigger.payload as ContentRow;
          const prayerName = trigger.key.split(':')[1];
          await sendMessage(formatPrayerReminder(prayerName, content));
          break;
        }

        case 'general_dhikr': {
          const content = trigger.payload as ContentRow;
          await sendMessage(formatContent(content));
          break;
        }

        default:
          console.warn(`[main] Unknown trigger kind: ${trigger.kind}`);
      }

      // Log successful send
      await logSent(trigger.key, today);
      console.log(`[main] ✅ Sent and logged: ${trigger.key}`);
    } catch (err) {
      console.error(`[main] ❌ Error processing trigger ${trigger.key}:`, err);
      // Continue with other triggers even if one fails
    }
  }

  console.log('[main] TeleDhikr cron run complete.');
}

// Run and handle exit
main()
  .catch((err) => {
    console.error('[main] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
    console.log('[main] Database pool closed.');
  });
