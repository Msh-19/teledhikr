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

interface ContentEntry {
  category: string;
  text: string;
}

const CONTENT: ContentEntry[] = [
  // General Dhikr
  {
    category: 'general_dhikr',
    text: '📿 <b>SubhanAllah wa bihamdihi, SubhanAllah al-Azeem</b>\n\nسُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ\n\n<i>"Two words that are light on the tongue, heavy on the Scale, and beloved to the Most Merciful."</i> — (Bukhari & Muslim)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>La ilaha illallah wahdahu la sharika lah</b>\n\nلَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ\n\n<i>"Whoever says this 100 times a day will have the reward of freeing 10 slaves, 100 good deeds recorded, 100 sins erased, and will be protected from Shaytan."</i> — (Bukhari & Muslim)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>Astaghfirullah</b>\n\nأَسْتَغْفِرُ اللَّهَ\n\n<i>"By Allah, I seek Allah\'s forgiveness and turn to Him in repentance more than 70 times a day."</i> — Prophet Muhammad ﷺ (Bukhari)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>Allahumma salli ala Muhammad</b>\n\nاللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ\n\n<i>"Whoever sends blessings upon me once, Allah will send blessings upon him tenfold."</i> — Prophet Muhammad ﷺ (Muslim)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>La hawla wa la quwwata illa billah</b>\n\nلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ\n\n<i>"It is a treasure from the treasures of Paradise."</i> — Prophet Muhammad ﷺ (Bukhari & Muslim)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>Hasbunallahu wa ni\'mal wakeel</b>\n\nحَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ\n\n<i>"Allah is sufficient for us, and He is the best Disposer of affairs."</i> — (Quran 3:173)\n\nThe words Ibrahim عليه السلام said when thrown into the fire, and the Companions said when told the enemy had gathered against them.',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>Alhamdulillah</b>\n\nالْحَمْدُ لِلَّهِ\n\n<i>"Alhamdulillah fills the Scale. SubhanAllah and Alhamdulillah fill what is between the heavens and the earth."</i> — Prophet Muhammad ﷺ (Muslim)',
  },
  {
    category: 'general_dhikr',
    text: '📿 <b>SubhanAllah, Alhamdulillah, Allahu Akbar</b>\n\nسُبْحَانَ اللَّهِ، الْحَمْدُ لِلَّهِ، اللَّهُ أَكْبَرُ\n\n<i>"Say SubhanAllah 33 times, Alhamdulillah 33 times, and Allahu Akbar 34 times after every prayer."</i> — Prophet Muhammad ﷺ (Muslim)',
  },

  // Jummah-specific content
  {
    category: 'jummah',
    text: '📖 <b>Surah al-Kahf Reminder</b>\n\n<i>"Whoever reads Surah al-Kahf on Friday, a light will shine for him between the two Fridays."</i> — (al-Hakim, Sahih)\n\nHave you read your Surah al-Kahf today? 🕌',
  },
  {
    category: 'jummah',
    text: '🤲 <b>Abundant Salawat on Friday</b>\n\nاللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ\n\n<i>"Send abundant blessings upon me on Friday, for your blessings are presented to me."</i> — Prophet Muhammad ﷺ (Abu Dawud)\n\nIncrease your salawat today! ﷺ',
  },
  {
    category: 'jummah',
    text: '🕐 <b>Hour of Acceptance on Friday</b>\n\n<i>"There is an hour on Friday during which no Muslim asks Allah for something while standing in prayer except that He gives it to them."</i> — Prophet Muhammad ﷺ (Bukhari & Muslim)\n\nMake abundant du\'a, especially in the last hour before Maghrib. 🤲',
  },
  {
    category: 'jummah',
    text: '🚶 <b>Virtues of Friday</b>\n\n<i>"Whoever takes a bath on Friday, goes to the mosque early, walks and does not ride, sits close to the Imam, listens and does not speak — for every step he will have the reward of a year\'s fasting and praying at night."</i> — (Abu Dawud, Tirmidhi)\n\nMake the most of this blessed day! 🕌',
  },
];

async function seedContent(): Promise<void> {
  console.log('[seed-content] Inserting content entries...');

  // Clear existing content to avoid duplicates on re-run
  await pool.query('DELETE FROM content');

  let inserted = 0;
  for (const entry of CONTENT) {
    await pool.query(
      'INSERT INTO content (category, text, active) VALUES ($1, $2, true)',
      [entry.category, entry.text]
    );
    inserted++;
  }

  console.log(`[seed-content] ✅ Inserted ${inserted} content entries`);
}

seedContent()
  .catch((err) => {
    console.error('[seed-content] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
