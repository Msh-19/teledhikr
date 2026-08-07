# TeleDhikr — Islamic Daily Remembrance Bot

A Telegram bot that sends context-aware Islamic reminders throughout the day: morning/evening adhkar, prayer-time-anchored reminders, Jummah reminders, Hijri calendar events, and virtuous fasting day alerts.

## Architecture

```
Render Cron Job (every 15 min)
  └─ main.ts
       ├─ Fetch/cache daily prayer times + Hijri date (Aladhan API → daily_context table)
       ├─ Resolve which triggers are due (context-resolver)
       ├─ Check sent_log to avoid duplicates
       ├─ Send messages via Telegram Bot API (Telegraf)
       └─ Log sends → exit
```

**Design principle**: Content selection is driven by a *context resolver* that knows the current time, prayer schedule, day of week, and Hijri date — not random selection from a pool.

## Features

| Trigger | Description |
|---|---|
| **Morning Adhkar** | Full sequence sent after Fajr (35 adhkar, one message each) |
| **Evening Adhkar** | Full sequence sent before Maghrib |
| **Prayer Reminders** | Short dhikr after each of the 5 prayers |
| **Jummah** | Friday-specific content (Surah al-Kahf, salawat, etc.) |
| **Hijri Events** | Significant Islamic dates (Ramadan, Eid, Ashura, etc.) |
| **Fasting Reminders** | Sent the *evening before* (Mon/Thu, Ayyam al-Beedh, Arafah, etc.) |
| **General Dhikr** | Fallback reminders with 3-hour cooldown |

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Bot**: Telegraf (Telegram Bot API)
- **Database**: PostgreSQL ([Neon](https://neon.tech) — free tier)
- **Hosting**: GitHub Actions Scheduled Workflow (100% free)
- **External API**: [Aladhan](https://aladhan.com/prayer-times-api) (prayer times + Hijri date)

## Setup

### Prerequisites

- Node.js 20+
- [Neon](https://neon.tech) PostgreSQL database (free tier)
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Your Telegram chat ID

### Local Development

```bash
# Clone and install
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your values

# Initialize database tables
npm run init-db

# Seed data
npm run seed

# Run once locally
npm run dev
```

### GitHub Actions Deployment (100% Free)

1. Push your repository to GitHub.
2. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret** and add the following secrets:
   - `DATABASE_URL`: Your Neon connection string
   - `BOT_TOKEN`: Your Telegram bot token
   - `CHAT_ID`: Your Telegram chat ID
   - `LATITUDE`: `9.0192` (or your latitude)
   - `LONGITUDE`: `38.7525` (or your longitude)
   - `TIMEZONE`: `Africa/Addis_Ababa` (or your timezone)
   - `PRAYER_METHOD`: `3`
4. That's it! GitHub Actions will run the bot automatically every 15 minutes.
5. You can also trigger a manual run anytime from the **Actions** tab in GitHub by selecting **TeleDhikr Cron Job** → **Run workflow**.

## Project Structure

```
teledhikr/
├── src/
│   ├── types.ts              # Shared interfaces
│   ├── config.ts             # Environment config + constants
│   ├── db.ts                 # PostgreSQL pool + helpers
│   ├── aladhan.ts            # Prayer times API + caching
│   ├── context-resolver.ts   # Brain: what triggers are due now?
│   ├── telegram.ts           # Message formatting + sending
│   └── main.ts               # Cron entrypoint
├── scripts/
│   ├── init-db.ts            # Create database tables
│   ├── seed-adhkar.ts        # Seed adhkar from GitHub dataset
│   ├── seed-content.ts       # Seed general dhikr + jummah content
│   └── seed-hijri-events.ts  # Seed Hijri events + fasting days
├── package.json
├── tsconfig.json
├── render.yaml
└── .env.example
```

## Adhkar Data Source

Adhkar are seeded from [Seen-Arabic/Morning-And-Evening-Adhkar-DB](https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB) (MIT license) — 35 authentic morning/evening adhkar with Arabic, English translation, transliteration, repeat count, virtue, and source.

## License

MIT
