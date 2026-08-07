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
- **Database**: PostgreSQL ([Neon](https://neon.tech) — free tier, serverless)
- **Hosting**: Render Cron Job
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
# Edit .env with your values (see Neon setup below)

# Initialize database tables
npm run init-db

# Seed data
npm run seed

# Run once
npm run dev
```

### Neon Database Setup

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project (any region)
3. Go to **Connection Details** in your project dashboard
4. Copy the connection string — it looks like:
   ```
   postgresql://user:pass@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Paste it as `DATABASE_URL` in your `.env` file

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `BOT_TOKEN` | ✅ | Telegram bot token |
| `CHAT_ID` | ✅ | Telegram chat ID to send messages to |
| `LATITUDE` | ✅ | Location latitude for prayer times |
| `LONGITUDE` | ✅ | Location longitude for prayer times |
| `TIMEZONE` | ✅ | IANA timezone (e.g., `Asia/Riyadh`) |
| `PRAYER_METHOD` | ❌ | Aladhan calculation method (default: `4` = Umm al-Qura) |

### Deploy to Render

1. Push code to a Git repository
2. In Render dashboard, click **New** → **Blueprint**
3. Connect your repo — Render will detect `render.yaml`
4. Set the environment variables:
   - `DATABASE_URL` — your Neon connection string
   - `BOT_TOKEN`, `CHAT_ID`, `LATITUDE`, `LONGITUDE`, `TIMEZONE`
5. After first deploy, run the seed scripts (locally, pointing at your Neon DB):
   ```bash
   DATABASE_URL="your_neon_connection_string" npm run seed
   ```

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
