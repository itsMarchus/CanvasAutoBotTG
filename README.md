# Canvas Telegram Academic Assistant

## Project Overview

This project is a personal academic notification and assistance system that connects **Canvas LMS** with **Telegram**.

The system will monitor relevant information from Canvas, such as assignments and announcements, and send notifications to a Telegram bot. Later, the Telegram bot will also be connected to **Gemini** so the user can interact with an AI assistant directly through Telegram.

The project will be developed incrementally. We will first make the **Telegram bot** work independently, then learn and integrate the **Canvas API**, and only after the Canvas → Telegram system is stable will we integrate Gemini.

---

# Main Goal

Build a cloud-hosted system that can:

1. Receive relevant academic information from Canvas.
2. Notify the user through Telegram.
3. Allow the user to interact with the Telegram bot.
4. Eventually use Gemini as an AI assistant through Telegram.
5. Eventually retrieve relevant Canvas information and provide it to Gemini as context.

The intended final flow is:

```text
                         Canvas LMS
                             │
                       Canvas API
                             │
                             ▼
                  ┌─────────────────────┐
                  │   Backend Service   │
                  │                     │
                  │ Node.js + TypeScript│
                  └──────────┬──────────┘
                             │
                    Telegram Bot API
                             │
                             ▼
                         Telegram
                             │
                      User interaction
                             │
                             ▼
                           Gemini
```

---

# Development Philosophy

Do **not** build the entire system at once.

The project should be developed in small, independently testable stages.

## Phase 1 — Telegram Bot

First, build a basic Telegram bot.

Goals:

* Create a Telegram bot using BotFather.
* Securely store the bot token.
* Connect the Node.js application to Telegram.
* Send messages through the Telegram Bot API.
* Receive messages from Telegram.
* Implement basic commands such as `/start` and `/help`.

Initial architecture:

```text
User
  │
  ▼
Telegram
  │
  ▼
Telegram Bot API
  │
  ▼
Node.js + TypeScript
```

The first successful milestone is:

```text
User sends:
/start

Bot responds:
Hello! Your Canvas Academic Assistant is working.
```

---

# Phase 2 — Learn and Integrate Canvas API

After Telegram is working, learn the Canvas API independently.

Goals:

* Understand Canvas API authentication.
* Understand Canvas API endpoints.
* Retrieve the current user.
* Retrieve enrolled courses.
* Retrieve course assignments.
* Retrieve assignment details.
* Retrieve announcements.
* Understand Canvas API pagination.
* Understand permissions and API scopes.
* Understand rate limits.
* Understand Canvas webhooks/Live Events where applicable.

Initial Canvas architecture:

```text
Node.js + TypeScript
        │
        ▼
    Canvas API
        │
        ▼
    Canvas LMS
```

The first Canvas milestone is successfully retrieving information such as the authenticated user and enrolled courses.

---

# Phase 3 — Connect Canvas to Telegram

Once both systems work independently, connect them.

Target architecture:

```text
Canvas LMS
    │
    │ Canvas API / Events
    ▼
Node.js Backend
    │
    │ Telegram Bot API
    ▼
Telegram
    │
    ▼
User
```

Example notification:

```text
🔔 New Canvas Assignment

Course:
IT 214 - Database Management

Assignment:
Database Normalization Activity

Due:
August 20, 2026 at 11:59 PM

[Open in Canvas]
```

The system should eventually detect relevant new or changed Canvas content and send appropriate Telegram notifications.

---

# Phase 4 — Notification Reliability

The original motivation for this project is that Canvas notifications are sometimes reportedly not reaching students.

Therefore, this system should eventually act as a **secondary notification channel**, not as a replacement for Canvas itself.

The system should consider:

* Duplicate notifications
* Failed Telegram deliveries
* Assignment updates
* Due-date changes
* Deleted assignments
* Announcements
* Notification history
* Retry behavior
* Rate limits
* Logging

The database may eventually contain records such as:

```text
notification_id
canvas_event_id
canvas_user_id
course_id
assignment_id
notification_type
telegram_chat_id
status
sent_at
created_at
```

---

# Phase 5 — Gemini Integration

Gemini will **not** be integrated during the initial development.

Only integrate Gemini after the Canvas → Telegram pipeline is stable.

Target architecture:

```text
User
  │
  │ Telegram message
  ▼
Telegram Bot
  │
  ▼
Node.js Backend
  │
  ├───────────────┐
  │               │
  ▼               ▼
Canvas API      Gemini API
  │               │
  │               │
  └───────┬───────┘
          ▼
       Response
          │
          ▼
       Telegram
```

The eventual assistant should be able to help the user understand academic information available through Canvas.

Potential capabilities:

* Explain assignment instructions.
* Summarize announcements.
* Explain course material.
* Answer questions about deadlines.
* Help brainstorm responses.
* Explain difficult concepts.
* Review or provide feedback on a student's draft.
* Use relevant Canvas information as context when answering.

The AI should not automatically submit assignments or impersonate the student.

---

# Phase 6 — Canvas-Aware AI

Eventually, Gemini should not rely only on its general knowledge.

When the user asks something related to a Canvas course, the backend should retrieve relevant information from Canvas and provide it as context to Gemini.

Example:

```text
User:
"What exactly does our Database Activity 3 require?"

        │
        ▼

Telegram Bot

        │
        ▼

Backend

        │
        ├── Search Canvas assignments
        │
        └── Retrieve Activity 3

        │
        ▼

Relevant Canvas information

        │
        ▼

Gemini

        │
        ▼

Explanation

        │
        ▼

Telegram
```

This approach is intended to make the assistant answer based on the user's actual course information rather than guessing.

---

# Technology Stack

## Current

* Node.js
* TypeScript
* pnpm
* Telegram Bot API

## Planned

* Canvas REST API
* Canvas webhooks / Live Events where appropriate
* Gemini API
* PostgreSQL / Supabase
* Cloud hosting

Potential architecture:

```text
Frontend
   │
   │ Not initially required
   │
Backend
   │
   ├── Canvas API
   ├── Telegram Bot API
   ├── Gemini API
   └── PostgreSQL / Supabase
```

---

# Project Structure

The project will gradually evolve into something similar to:

```text
canvas-telegram-agent/
│
├── src/
│   │
│   ├── index.ts
│   │
│   ├── telegram/
│   │   ├── bot.ts
│   │   ├── handlers.ts
│   │   └── messages.ts
│   │
│   ├── canvas/
│   │   ├── client.ts
│   │   ├── assignments.ts
│   │   ├── courses.ts
│   │   └── announcements.ts
│   │
│   ├── gemini/
│   │   └── client.ts
│   │
│   ├── database/
│   │   └── ...
│   │
│   └── config/
│       └── env.ts
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

Do not create all of these directories immediately. Add them as the corresponding phase is implemented.

---

# Security Requirements

Sensitive credentials must never be committed to Git.

Examples:

```text
TELEGRAM_BOT_TOKEN
CANVAS_ACCESS_TOKEN
GEMINI_API_KEY
DATABASE_URL
```

These should be stored in environment variables.

Example:

```env
TELEGRAM_BOT_TOKEN=
CANVAS_BASE_URL=
CANVAS_ACCESS_TOKEN=
GEMINI_API_KEY=
DATABASE_URL=
```

`.env` must be included in `.gitignore`.

An `.env.example` file may contain variable names but must never contain real credentials.

---

# Important Development Rules

## 1. Do not skip phases

Do not integrate Gemini before the Canvas → Telegram system is functional.

## 2. Keep services separated

Canvas, Telegram, Gemini, and the database should have separate modules.

Avoid putting the entire application inside `index.ts`.

## 3. Use TypeScript

Use TypeScript throughout the backend.

Avoid unnecessary JavaScript files.

## 4. Learn the APIs

Do not immediately hide all API behavior behind third-party libraries.

During the learning phase, understand the underlying HTTP requests, authentication, responses, and errors.

## 5. Keep the first implementation simple

The first version should prioritize:

* Correctness
* Understandability
* Security
* Good project structure

Do not add unnecessary features early.

## 6. Do not assume Canvas permissions

Canvas access depends on the school's configuration and the authenticated user's permissions.

Do not assume that every Canvas API endpoint will be available.

## 7. Do not expose credentials

Never print API keys or bot tokens in logs.

Never commit them to GitHub.

---

# Current Development Status

## Phase 1 — Telegram Bot

Status: **Starting**

Current goal:

```text
Create Node.js + TypeScript project
        ↓
Create Telegram bot
        ↓
Connect Telegram Bot API
        ↓
Implement /start
        ↓
Test communication
```

## Phase 2 — Canvas API

Status: Not started

## Phase 3 — Canvas → Telegram

Status: Not started

## Phase 4 — Notification Reliability

Status: Not started

## Phase 5 — Gemini

Status: Not started

## Phase 6 — Canvas-Aware AI

Status: Not started

---

# First Milestone

The immediate goal is:

> **Create a working Telegram bot using Node.js and TypeScript that can receive `/start` and respond to the user.**

Do not work on Canvas or Gemini until this milestone works.

After that, proceed to learning the Canvas API.
