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

interface HijriEventEntry {
  hijri_month: number | null;
  hijri_day: number | null;
  label: string;
  category: string;
  message: string;
}

const HIJRI_EVENTS: HijriEventEntry[] = [
  // === HIJRI EVENTS ===

  // Muharram
  {
    hijri_month: 1,
    hijri_day: 1,
    label: 'Islamic New Year',
    category: 'hijri_event',
    message: '🌙 <b>Happy Islamic New Year!</b>\n\nMay Allah bless this new Hijri year and fill it with goodness, barakah, and guidance.\n\n<i>"O Allah, bring it upon us with security, faith, safety, and Islam."</i>\n\n🤲 Reflect on the Hijrah of the Prophet ﷺ — a journey of faith, sacrifice, and trust in Allah.',
  },
  {
    hijri_month: 1,
    hijri_day: 10,
    label: 'Ashura',
    category: 'hijri_event',
    message: '📿 <b>Today is Ashura — the 10th of Muharram</b>\n\nA great day in the sight of Allah. The Prophet ﷺ said:\n\n<i>"Fasting the Day of Ashura, I hope that Allah will accept it as expiation for the previous year."</i> — (Muslim)\n\nMay Allah accept your fast and worship. 🤲',
  },

  // Rabi al-Awwal
  {
    hijri_month: 3,
    hijri_day: 12,
    label: 'Mawlid an-Nabi',
    category: 'hijri_event',
    message: '🕌 <b>Mawlid an-Nabi ﷺ</b>\n\nToday marks the birth of our beloved Prophet Muhammad ﷺ — the mercy to all worlds.\n\n<i>"Indeed, Allah and His angels send blessings upon the Prophet. O you who believe, send blessings upon him and greet him with peace."</i> — (Quran 33:56)\n\nIncrease your salawat upon him today. ﷺ',
  },

  // Rajab
  {
    hijri_month: 7,
    hijri_day: 27,
    label: "Isra' wal Mi'raj",
    category: 'hijri_event',
    message: '✨ <b>The Night of Isra\' and Mi\'raj</b>\n\n<i>"Glory be to the One Who took His servant by night from the Sacred Mosque to the Farthest Mosque."</i> — (Quran 17:1)\n\nTonight commemorates the miraculous night journey and ascension of the Prophet ﷺ, when the five daily prayers were gifted to this Ummah.\n\n🤲 May we treasure and guard our salah.',
  },

  // Sha'ban
  {
    hijri_month: 8,
    hijri_day: 15,
    label: "Mid-Sha'ban",
    category: 'hijri_event',
    message: '🌙 <b>The Middle of Sha\'ban</b>\n\nThe Prophet ﷺ said:\n\n<i>"Allah looks at His creation on the night of the middle of Sha\'ban and forgives all of them, except for the one who associates partners with Him or the one who harbors hatred."</i> — (Ibn Majah)\n\n🤲 Seek forgiveness and purify your heart tonight.',
  },

  // Ramadan
  {
    hijri_month: 9,
    hijri_day: 1,
    label: 'Ramadan Start',
    category: 'hijri_event',
    message: '🌙 <b>Ramadan Mubarak!</b>\n\nThe blessed month of Ramadan has begun! ✨\n\n<i>"When Ramadan begins, the gates of Paradise are opened, the gates of Hellfire are closed, and the devils are chained."</i> — (Bukhari & Muslim)\n\nMay Allah grant us the strength to fast, pray, and worship with sincerity. 🤲\n\n🕌 Make the most of every moment of this blessed month.',
  },

  // Last 10 nights of Ramadan (days 21-29)
  ...Array.from({ length: 9 }, (_, i) => ({
    hijri_month: 9,
    hijri_day: 21 + i,
    label: 'Last 10 Nights of Ramadan',
    category: 'hijri_event' as const,
    message: `🌙 <b>Last Ten Nights of Ramadan — Night ${21 + i}</b>\n\n<i>"Search for Laylat al-Qadr in the odd nights of the last ten nights of Ramadan."</i> — Prophet Muhammad ﷺ (Bukhari)\n\n<i>"Laylat al-Qadr is better than a thousand months."</i> — (Quran 97:3)\n\n🤲 <b>Du'a for tonight:</b>\nاللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي\n<i>"O Allah, You are the Pardoner, You love to pardon, so pardon me."</i>\n\nStand in prayer, make du'a, and seek Laylat al-Qadr. ✨`,
  })),

  // Shawwal
  {
    hijri_month: 10,
    hijri_day: 1,
    label: 'Eid al-Fitr',
    category: 'hijri_event',
    message: '🎉 <b>Eid al-Fitr Mubarak!</b>\n\nتَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ\n<i>Taqabbal Allahu minna wa minkum</i>\n(May Allah accept from us and from you)\n\n🕌 Don\'t forget:\n• Zakat al-Fitr before the Eid prayer\n• Eid Takbeeraat\n• Spreading joy and visiting family\n\nMay Allah bless you and your loved ones on this joyous day! 🤲',
  },

  // Dhul Hijjah
  {
    hijri_month: 12,
    hijri_day: 8,
    label: 'Day of Tarwiyah',
    category: 'hijri_event',
    message: '🕋 <b>Day of Tarwiyah — 8th Dhul Hijjah</b>\n\nToday marks the beginning of the Hajj rites as pilgrims head to Mina.\n\n<i>"There are no days in which good deeds are more beloved to Allah than these ten days."</i> — Prophet Muhammad ﷺ (Bukhari)\n\n🤲 Continue with dhikr, fasting, and good deeds.',
  },
  {
    hijri_month: 12,
    hijri_day: 9,
    label: 'Day of Arafah',
    category: 'hijri_event',
    message: '🕋 <b>The Day of Arafah — 9th Dhul Hijjah</b>\n\nThe greatest day of the year!\n\n<i>"There is no day on which Allah frees more people from the Fire than the Day of Arafah."</i> — (Muslim)\n\n<i>"The best du\'a is du\'a on the Day of Arafah."</i> — (Tirmidhi)\n\n🤲 Spend today in du\'a, dhikr, and repentance. May Allah accept it from you.',
  },
  {
    hijri_month: 12,
    hijri_day: 10,
    label: 'Eid al-Adha',
    category: 'hijri_event',
    message: '🎉 <b>Eid al-Adha Mubarak!</b>\n\nتَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ\n<i>Taqabbal Allahu minna wa minkum</i>\n\n<i>"The greatest day in the sight of Allah is the Day of Sacrifice."</i> — (Abu Dawud)\n\n🕌 Don\'t forget:\n• Eid Takbeeraat\n• Eid prayer\n• Qurbani / Udhiyah\n\nMay Allah accept our sacrifices and worship. 🤲',
  },

  // === FASTING EVENTS ===

  // Muharram fasting
  {
    hijri_month: 1,
    hijri_day: 9,
    label: 'Tasua',
    category: 'fasting',
    message: '🌙 <b>Fasting Reminder: Tasua & Ashura</b>\n\nTomorrow is the 9th of Muharram (Tasua). The Prophet ﷺ said:\n\n<i>"If I live until next year, I will fast on the 9th (as well as the 10th)."</i> — (Muslim)\n\nIt is Sunnah to fast the 9th and 10th of Muharram together. Make your intention tonight. 🤲',
  },
  {
    hijri_month: 1,
    hijri_day: 10,
    label: 'Ashura',
    category: 'fasting',
    message: '🌙 <b>Fasting Reminder: Ashura</b>\n\nTomorrow is the 10th of Muharram (Ashura).\n\n<i>"Fasting the Day of Ashura, I hope that Allah will accept it as expiation for the previous year."</i> — Prophet Muhammad ﷺ (Muslim)\n\nMake your intention to fast tonight. 🤲',
  },

  // Ayyam al-Beedh (13th, 14th, 15th of EVERY Hijri month)
  {
    hijri_month: null,
    hijri_day: 13,
    label: 'Ayyam al-Beedh',
    category: 'fasting',
    message: '🌕 <b>Fasting Reminder: Ayyam al-Beedh</b>\n\nTomorrow begins the White Days (13th–15th of the Hijri month).\n\n<i>"The Prophet ﷺ used to command us to fast the three white days: the 13th, 14th, and 15th."</i> — (Nasa\'i)\n\n<i>"Fasting three days of each month is equivalent to fasting the entire year."</i> — (Bukhari & Muslim)\n\nMake your intention tonight. 🤲',
  },

  // Day of Arafah fasting
  {
    hijri_month: 12,
    hijri_day: 9,
    label: 'Day of Arafah',
    category: 'fasting',
    message: '🕋 <b>Fasting Reminder: Day of Arafah</b>\n\nTomorrow is the Day of Arafah (9th Dhul Hijjah).\n\n<i>"Fasting the Day of Arafah, I hope that Allah will accept it as expiation for the year before and the year after."</i> — Prophet Muhammad ﷺ (Muslim)\n\nThis is the most virtuous fast outside of Ramadan. Make your intention tonight! 🤲',
  },

  // Six days of Shawwal
  {
    hijri_month: 10,
    hijri_day: 2,
    label: 'Six of Shawwal',
    category: 'fasting',
    message: '🌙 <b>Fasting Reminder: Six Days of Shawwal</b>\n\nThe six fasts of Shawwal are now open!\n\n<i>"Whoever fasts Ramadan then follows it with six days of Shawwal, it is as if they fasted the entire year."</i> — Prophet Muhammad ﷺ (Muslim)\n\nYou can fast them consecutively or spread them throughout the month. Make your intention tonight! 🤲',
  },

  // First 9 days of Dhul Hijjah (fasting reminder on the evening of the last day of Dhul Qa'dah and each day during)
  {
    hijri_month: 12,
    hijri_day: 1,
    label: 'First Days of Dhul Hijjah',
    category: 'fasting',
    message: '🕋 <b>Fasting Reminder: First Days of Dhul Hijjah</b>\n\nThe blessed first days of Dhul Hijjah have begun!\n\n<i>"There are no days in which good deeds are more beloved to Allah than these ten days."</i> — Prophet Muhammad ﷺ (Bukhari)\n\nFasting during these days (especially the 9th — Day of Arafah) is highly recommended. Make your intention tonight! 🤲',
  },
  ...Array.from({ length: 7 }, (_, i) => ({
    hijri_month: 12,
    hijri_day: 2 + i, // days 2-8
    label: 'First Days of Dhul Hijjah',
    category: 'fasting' as const,
    message: `🕋 <b>Fasting Reminder: ${3 + i}${['rd','th','th','th','th','th','th'][i]} of Dhul Hijjah</b>\n\n<i>"There are no days in which good deeds are more beloved to Allah than these ten days."</i> — Prophet Muhammad ﷺ (Bukhari)\n\nContinue fasting and doing good deeds in these blessed days. 🤲`,
  })),
];

async function seedHijriEvents(): Promise<void> {
  console.log('[seed-hijri] Inserting hijri events...');

  // Clear existing to avoid duplicates on re-run
  await pool.query('DELETE FROM hijri_events');

  let inserted = 0;
  for (const event of HIJRI_EVENTS) {
    await pool.query(
      'INSERT INTO hijri_events (hijri_month, hijri_day, label, category, message) VALUES ($1, $2, $3, $4, $5)',
      [event.hijri_month, event.hijri_day, event.label, event.category, event.message]
    );
    inserted++;
  }

  console.log(`[seed-hijri] ✅ Inserted ${inserted} hijri event entries`);
}

seedHijriEvents()
  .catch((err) => {
    console.error('[seed-hijri] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
