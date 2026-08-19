# 🎓 Canvas Telegram AI Assistant

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg?logo=node.js)](https://nodejs.org/)
[![grammY](https://img.shields.io/badge/Telegram_Bot-grammY-24A1DE.svg?logo=telegram)](https://grammy.dev/)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_Flash-orange.svg?logo=google)](https://aistudio.google.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent, 24/7 self-hosted Telegram assistant for **Canvas LMS**. Delivers real-time push notifications for new announcements and assignments, urgent **3-hour and 1-hour deadline countdown alerts**, and features an autonomous **Google Gemini AI Agent** with function-calling capabilities to explain instructions, solve assignment questions, and generate personalized study plans.

---

## ✨ Key Features

* 🔔 **Proactive Push Notifications**: Automatically alerts you on Telegram whenever an instructor posts a new assignment or course announcement (polled every 10 minutes).
* ⏰ **Multi-Stage Deadline Reminders**:
  * **3-Hour Warning**: Sent between 3 hours and 1 hour 15 minutes before the due date.
  * **1-Hour Urgent Alert**: Sent when less than 75 minutes remain.
  * Automatic suppression for assignments you have already submitted in Canvas.
* 🤖 **Gemini AI Academic Agent**:
  * **Function Calling / Tools**: The AI can query your enrolled courses, search assignments by name or ID, inspect full instructions, and check due dates in real time.
  * **`/explain <id>`**: Breaks down complex assignment prompts into step-by-step checklists and rubrics.
  * **`/answer <id>`**: Generates comprehensive, step-by-step answers and explanations for text-based assignment questions.
  * **`/studyplan`**: Analyzes all upcoming active tasks and builds a realistic 7-day prioritized study schedule.
  * **Free-Form Chat**: Ask anything in plain English (e.g. *"What homework is due this Friday?"* or *"Summarize the latest math announcement"*).
  * **Multi-Turn Memory**: Remembers previous turns in the chat, persisted via Supabase PostgreSQL.
  * **Multi-Model Fallback Engine**: Automatic retry with exponential backoff and automatic failover across models (`gemini-flash-latest` ➔ `gemini-flash-lite-latest` ➔ `gemini-3.1-flash-lite`) to guarantee 99.9% uptime on the free tier.
* 📱 **Interactive Inline Keyboards**: Browse courses, view upcoming tasks, inspect details, and trigger AI explanations with tap-friendly Telegram buttons.
* 🛡️ **Built-in Security**: Single-user owner lock (`TELEGRAM_ALLOWED_USER_ID`) preventing unauthorized users from accessing your academic data.
* ☁️ **Cloud & Docker Ready**: Optimized for 1-click 24/7 cloud hosting on Render, Railway, Fly.io, or VPS with health check endpoints and zero cold-start crashes.

---

## 🏗️ System Architecture

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                         Canvas LMS                          │
  │     (Courses, Assignments, Announcements, Submissions)      │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ REST API (Bearer Token)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 Canvas Telegram AI Agent                    │
  │                     (Node.js + TS)                          │
  │                                                             │
  │  ┌──────────────────────┐        ┌───────────────────────┐  │
  │  │ Background Notifier  │        │  Gemini AI Subagent   │  │
  │  │  (Cron Polling Loop) │        │ (Function Calling)    │  │
  │  └──────────┬───────────┘        └───────────┬───────────┘  │
  └─────────────┼────────────────────────────────┼──────────────┘
                │                                │
    Deduplication & State                  Tool Execution &
    (RLS Enabled)                          Conversation Memory
                ▼                                ▼
  ┌───────────────────────────┐    ┌───────────────────────────┐
  │    Supabase PostgreSQL    │    │      Google Gemini API    │
  │ (seen_items, logs, users) │    │   (gemini-flash-latest)   │
  └───────────────────────────┘    └───────────────────────────┘
                │                                │
                └───────────────┬────────────────┘
                                │ Telegram Bot API (grammY)
                                ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                     Telegram App (User)                     │
  │         (Push Alerts, Interactive Buttons, AI Chat)         │
  └─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Prerequisites (100% Free Tier Compatible)

Before setting up, gather the following 4 free credentials:

1. **Telegram Bot Token**:
   * Message [@BotFather](https://t.me/BotFather) on Telegram and create a new bot using `/newbot`. Copy the API Token.
   * *(Optional)* Message [@userinfobot](https://t.me/userinfobot) to get your numeric Telegram User ID.
2. **Canvas Access Token**:
   * Log into your Canvas account (e.g. `https://canvas.instructure.com` or your university's Canvas portal).
   * Go to **Account** ➔ **Settings** ➔ Scroll to **Approved Integrations** ➔ Click **+ New Access Token**.
   * Copy the generated token.
3. **Supabase PostgreSQL Database**:
   * Create a free project at [supabase.com](https://supabase.com/).
   * Under **Project Settings ➔ API**, copy your **Project URL** and **Service Role Secret (service_role)**.
4. **Google Gemini API Key**:
   * Get a free API key at [Google AI Studio](https://aistudio.google.com/).

---

## 🗄️ One-Click Database Setup

1. Open your Supabase Dashboard and navigate to the **SQL Editor**.
2. Click **New Query**.
3. Copy and paste the entire contents of [`scripts/supabase_schema.sql`](scripts/supabase_schema.sql).
4. Click **Run**.

This will automatically create all 5 required tables with Row-Level Security (RLS) policies:
* `bot_users`: Stores registered chat IDs and user settings.
* `seen_items`: Prevents duplicate announcement and assignment alerts.
* `notification_logs`: Ensures 3h and 1h deadline reminders trigger exactly once.
* `system_sync_state`: Tracks background polling health and course counts.
* `chat_history`: Stores multi-turn conversational context for Gemini AI.

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/canvas-telegram-agent.git
cd canvas-telegram-agent
```

### 2. Install dependencies
```bash
pnpm install
# or npm install / yarn install
```

### 3. Configure environment variables
Create a `.env` file from the example:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
CANVAS_BASE_URL=https://canvas.instructure.com/
CANVAS_ACCESS_TOKEN=29471~your_canvas_access_token_here
TIMEZONE=Asia/Manila
POLL_INTERVAL_CRON=*/10 * * * *
TELEGRAM_ALLOWED_USER_ID=8285969041
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
```

### 4. Run the bot
```bash
# Development (auto-reload on change)
pnpm dev

# Production build & run
pnpm build
pnpm start
```

---

## ☁️ 24/7 Cloud Deployment (Render / Docker)

This project includes a production multi-stage [`Dockerfile`](Dockerfile) and a lightweight HTTP health-check server on port 3000/10000.

### Deploying on [Render.com](https://render.com/) (Free / Web Service)

1. Fork or push this repository to your GitHub account.
2. Log into Render and click **New +** ➔ **Web Service**.
3. Connect your repository.
4. Set the following options:
   * **Runtime**: `Docker` (or Node with build command `pnpm install && pnpm build` and start command `node dist/index.js`).
   * **Plan**: `Free`.
5. Under **Environment Variables**, add the keys from your `.env` file (`TELEGRAM_BOT_TOKEN`, `CANVAS_BASE_URL`, `CANVAS_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TIMEZONE`, `TELEGRAM_ALLOWED_USER_ID`).
6. Click **Deploy Web Service**.

### ⚡ Keeping the Bot Awake 24/7 on Render Free Tier (UptimeRobot)

> [!IMPORTANT]
> Render's Free Web Services automatically spin down (sleep) after 15 minutes of inactivity if no incoming HTTP traffic is detected.

To keep your bot running continuously 24/7 for free, set up a free monitor using [UptimeRobot](https://uptimerobot.com/) (or [cron-job.org](https://cron-job.org/)) to ping your Render service's built-in HTTP health endpoint:

1. Create a free account at [uptimerobot.com](https://uptimerobot.com/).
2. Click **+ Add New Monitor**.
3. Configure the monitor:
   * **Monitor Type**: `HTTP(s)`
   * **Friendly Name**: `Canvas Telegram Bot`
   * **URL (or IP)**: `https://your-service-name.onrender.com` *(Replace with your primary Render URL)*
   * **Monitoring Interval**: `Every 5 minutes`
4. Click **Create Monitor**.

🎉 **Your bot will now stay awake and actively poll Canvas 24/7 without ever going to sleep!**

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `TELEGRAM_BOT_TOKEN` | **Yes** | — | Bot token obtained from [@BotFather](https://t.me/BotFather). |
| `CANVAS_BASE_URL` | **Yes** | — | URL of your Canvas instance (e.g. `https://canvas.instructure.com/`). |
| `CANVAS_ACCESS_TOKEN` | **Yes** | — | Personal access token generated in Canvas settings. |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL (`https://xyz.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Supabase `service_role` key (required for backend RLS bypass). |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key from Google AI Studio. |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | Model used for AI reasoning & function calling. |
| `TELEGRAM_ALLOWED_USER_ID` | No | `(auto-locked)` | Numeric Telegram User ID of the owner. If omitted, the first user to run `/start` becomes the owner. |
| `TIMEZONE` | No | `Asia/Manila` | IANA Timezone for deadline formatting (e.g. `America/New_York`, `UTC`). |
| `POLL_INTERVAL_CRON` | No | `*/10 * * * *` | Cron expression for Canvas background polling (default: every 10 mins). |
| `PORT` | No | `3000` | HTTP port for cloud health-check ping server. |

---

## 🤖 Command Reference

| Command | Description |
| :--- | :--- |
| `/start` | Welcome message, bot status check, and chat registration. |
| `/help` | Comprehensive user guide and command list. |
| `/todo` or `/unsubmitted` | View all pending and unsubmitted assignments. |
| `/courses` | Interactive list of all enrolled active Canvas courses. |
| `/assignments` | List all upcoming assignments sorted by due date. |
| `/announcements` | View recent course announcements across all active classes. |
| `/all` | View complete catalog of all course assignments. |
| `/completed` | View list of submitted/graded assignments. |
| `/past` | View past-due and archived assignments. |
| `/nodate` | View assignments that have no deadline set. |
| `/assignment <id>` | View complete details, points, and attachments for an assignment. |
| `/ask <question>` | Ask Gemini AI about your courses, homework, or schedule. |
| `/explain <id or name>` | AI breakdown of assignment instructions with rubrics and checklist. |
| `/answer <id or name>` | AI step-by-step solution for text-based assignment prompts. |
| `/studyplan` | AI-generated 7-day personalized study timetable based on real deadlines. |
| `/clear` or `/reset` | Clear conversational chat memory with Gemini. |
| `/status` or `/sync` | Display sync health, total courses, and timestamp of last check. |
| `/testnotify` | Dispatches an instant test push notification to verify delivery. |

---

## 📁 Project Structure

```text
canvas-telegram-agent/
├── Dockerfile                  # Multi-stage production container definition
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # Strict TypeScript configuration
├── scripts/
│   └── supabase_schema.sql     # 1-click database schema & RLS setup
├── src/
│   ├── index.ts                # Application entrypoint & HTTP health server
│   ├── ai/
│   │   ├── agent.ts            # Gemini conversational agent & fallback engine
│   │   ├── systemPrompt.ts     # System prompts & instruction guidelines
│   │   └── tools.ts            # Gemini Function-Calling tools (Canvas query API)
│   ├── bot/
│   │   ├── bot.ts              # grammY bot initialization & security middleware
│   │   ├── callbacks.ts        # Interactive inline keyboard handlers
│   │   ├── commands.ts         # Telegram command logic (/todo, /ask, /answer, etc.)
│   │   ├── formatters.ts       # HTML-safe Telegram formatters & Turndown engine
│   │   └── keyboards.ts        # Dynamic inline keyboard generators
│   ├── canvas/
│   │   ├── client.ts           # Canvas LMS REST API client
│   │   ├── courses.ts          # Course query helpers
│   │   ├── assignments.ts      # Assignment & submission fetchers
│   │   ├── announcements.ts    # Course announcement fetchers
│   │   └── types.ts            # Strict Canvas API TypeScript interfaces
│   ├── config/
│   │   └── env.ts              # Zod environment variable schema & validation
│   └── services/
│       ├── notifier.ts         # Background cron monitor & deadline reminder engine
│       └── storage.ts          # Supabase PostgreSQL / Local File storage layer
└── README.md
```

---

## 🛠️ Developer Customization Guide

This project is built with clean, modular TypeScript and is designed to be easily customized and extended for your specific academic or institutional needs.

### 1. ⏰ Customizing Due Date Reminder Windows
By default, the background monitor triggers alerts at **3 hours** and **1 hour** before a deadline.
* **File:** [`src/services/notifier.ts`](src/services/notifier.ts)
* To customize the reminder thresholds (e.g. adding a 24-hour reminder or switching to 2-hour warnings), edit the deadline calculation blocks inside `runSyncCycle()` in `src/services/notifier.ts`:
```typescript
// Example: Add a 24-Hour Reminder Alert (between 23h and 25h before due)
if (diffHours <= 25 && diffHours > 23 && !sentReminders.reminder_24h) {
    const text = formatDueReminderNotification(assignment, 24);
    await bot.api.sendMessage(targetChatId, text, { parse_mode: "HTML" });
    await storage.markDueReminderSent(assignment.id, "reminder_24h");
}
```

### 2. 🧠 Customizing AI Personality & System Prompts
* **File:** [`src/ai/systemPrompt.ts`](src/ai/systemPrompt.ts)
* You can easily adjust the assistant's persona, language, tone, strictness regarding academic integrity, or customize how it handles attachments and problem breakdowns inside `buildSystemPrompt()`.

### 3. 🧩 Adding New AI Tools (Function Calling)
The Gemini Agent uses native function calling to interact with Canvas in real time. You can add new capabilities (e.g. fetching grades, quizzes, syllabus, modules, or file downloads):
1. **Define Tool Schema**: Add the new tool definition to `canvasToolDeclarations` in [`src/ai/tools.ts`](src/ai/tools.ts).
2. **Implement Execution Logic**: Add the handler case in `executeCanvasTool()` in [`src/ai/tools.ts`](src/ai/tools.ts).
3. The AI will automatically decide when to invoke your new tool based on natural conversation with the student!

### 4. 📱 Adding Custom Telegram Commands & Keyboards
* **New Commands:** Add command handlers in [`src/bot/commands.ts`](src/bot/commands.ts) and register them with `bot.command("yourcommand", handler)` in [`src/bot/bot.ts`](src/bot/bot.ts).
* **Inline Keyboards:** Customize or create new button menus in [`src/bot/keyboards.ts`](src/bot/keyboards.ts) and handle their callback clicks in [`src/bot/callbacks.ts`](src/bot/callbacks.ts).

### 5. 🎨 Customizing Notification Templates & Formatting
* **File:** [`src/bot/formatters.ts`](src/bot/formatters.ts)
* All Telegram message templates (announcement alerts, assignment cards, deadline warnings, and HTML conversion) are located in `src/bot/formatters.ts`. You can modify the text layout, emoji accents, or HTML tags to match your desired aesthetic.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
