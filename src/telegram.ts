import { Telegraf } from 'telegraf';
import { config, ADHKAR_DELAY_MS } from './config.js';
import type { AdhkarRow, ContentRow, HijriEvent } from './types.js';

const bot = new Telegraf(config.botToken);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send a single text message to the configured chat
export async function sendMessage(text: string): Promise<void> {
  await bot.telegram.sendMessage(config.chatId, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

// Format and send an adhkar sequence (one message per dhikr, with delays)
export async function sendAdhkarSequence(
  rows: AdhkarRow[],
  session: 'morning' | 'evening'
): Promise<void> {
  const emoji = session === 'morning' ? '🌅' : '🌙';
  const label = session === 'morning' ? 'Morning' : 'Evening';

  // Header
  await sendMessage(
    `${emoji} <b>${label} Adhkar</b>\n\n` +
    `Starting the ${label.toLowerCase()} remembrances — ${rows.length} adhkar to recite.\n` +
    `May Allah accept them from you. 🤲`
  );
  await sleep(ADHKAR_DELAY_MS);

  // Each dhikr
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const num = i + 1;
    const repeatLabel = row.repeatCount > 1 ? `×${row.repeatCount}` : '';

    let message = `<b>${num}/${rows.length}</b>\n\n`;
    message += `${row.arabic}\n\n`;

    if (row.transliteration) {
      message += `<i>${row.transliteration}</i>\n\n`;
    }

    message += `${row.translation}\n\n`;

    const meta: string[] = [];
    if (repeatLabel) meta.push(repeatLabel);
    if (row.source) meta.push(`📖 ${row.source}`);
    if (meta.length > 0) {
      message += meta.join(' | ') + '\n';
    }

    if (row.virtue) {
      message += `\n🌟 <i>${row.virtue}</i>`;
    }

    await sendMessage(message);

    // Delay between messages (skip after last)
    if (i < rows.length - 1) {
      await sleep(ADHKAR_DELAY_MS);
    }
  }

  // Closing
  await sleep(ADHKAR_DELAY_MS);
  await sendMessage(
    `✅ <b>${label} adhkar complete</b>\n\n` +
    `May Allah accept your remembrance and grant you His protection. 🤲\n` +
    `<i>"Whoever says their morning and evening adhkar, Allah will suffice them."</i>`
  );
}

// Format a content row for sending
export function formatContent(content: ContentRow): string {
  return content.text;
}

// Format a Hijri event for sending
export function formatHijriEvent(event: HijriEvent): string {
  return event.message;
}

// Format a prayer reminder
export function formatPrayerReminder(prayerName: string, content: ContentRow): string {
  const prayerEmojis: Record<string, string> = {
    fajr: '🌅',
    dhuhr: '☀️',
    asr: '🌤️',
    maghrib: '🌅',
    isha: '🌙',
  };
  const emoji = prayerEmojis[prayerName] || '🕌';
  const displayName = prayerName.charAt(0).toUpperCase() + prayerName.slice(1);

  return (
    `${emoji} <b>Post-${displayName} Reminder</b>\n\n` +
    content.text
  );
}
