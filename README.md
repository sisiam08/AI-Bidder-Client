# AI Bidder — Browser Extension

Chrome extension (Manifest V3) that detects freelance jobs, analyzes them with AI, and auto-fills proposals after you approve them from Telegram. Built with [WXT](https://wxt.dev/), React, and Tailwind CSS.

## Features

- **Job detection** — content scripts watch Upwork and Freelancer.com listings and extract job details automatically (or on demand).
- **AI analysis** — extracted jobs are submitted to the [AI Bidder server](https://github.com/sisiam08/AI-Bidder-Server), which generates summaries, budget and timeline suggestions.
- **Telegram approval** — connect your Telegram bot in the popup; approve or reject jobs from chat using inline keyboard steppers, no need to open the extension.
- **Auto-fill on approval** — when a job is approved, the extension opens the exact job page, activates its tab, and fills the proposal automatically (with a fallback for pages opened before approval).
- **Real-time updates** — live job events over WebSocket (socket.io).
- **Setup popup** — configure email, AI provider (OpenRouter / Ollama), AI API key, and Telegram bot + chat in one place.

## Tech Stack

- [WXT](https://wxt.dev/) (Manifest V3, TypeScript)
- React 18 + [TanStack Query](https://tanstack.com/query) + [Zustand](https://zustand-docs.pmnd.rs/)
- Tailwind CSS + shadcn-style UI components
- `socket.io-client` for real-time job events
- `react-hot-toast` for in-page notifications

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- A running [AI Bidder server](https://github.com/sisiam08/AI-Bidder-Server) on `http://localhost:5000`
- (For auto-fill) a logged-in Upwork / Freelancer.com account

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Development build with hot reload
npm run dev
```

### Build & Load the Extension

```bash
npm run build
```

The unpacked extension is written to `.output/chrome-mv3`.

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin the **AI Bidder** extension and open its popup.

To produce a zip ready for the Chrome Web Store, run `npm run zip`.

> The extension communicates with the local server over `http://localhost:5000`; ensure the server is running before use.

## Setup

Open the extension popup and fill in:

| Field               | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| Email               | Your account email (used for session setup)                          |
| AI Provider         | `openrouter` (cloud) or `ollama` (local)                             |
| AI API Key          | OpenRouter key (required for `openrouter`; optional for `ollama`)    |
| Telegram Bot Token  | Token of the bot you created with [@BotFather](https://t.me/BotFather) |
| Telegram Chat ID    | Your chat id (used for notifications and approvals)                  |
| Detection mode      | `auto` (detect jobs continuously) or `manual`                        |
| Reload interval     | How often (min–max seconds) to refresh listings when auto-detecting  |

After saving, job notifications and the Approve / Reject keyboard will arrive in your Telegram chat.

## How Approval Works

1. A job is detected on Upwork or Freelancer.com and submitted to the server.
2. The server analyzes it and sends a Telegram notification with suggested budget and timeline.
3. Tap **Approve** in Telegram.
4. The server broadcasts `job.approved` over WebSocket; the extension:
   - builds the job's proposal URL (`getProposalUrl`),
   - finds an already-open tab for the exact job (`matchesProposalTab` — matches Upwork `~id` / Freelancer `/projects/` slug),
   - activates that tab and sends `FILL_PROPOSAL` to the content script; otherwise it opens the job page in a new tab.
5. The content script fills the proposal form with the AI-generated cover letter and budget.

## Available Scripts

| Script             | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start WXT dev server with HMR        |
| `npm run build`    | Build the extension to `.output/chrome-mv3` |
| `npm run zip`      | Build and package a zip artifact     |
| `npm run compile`  | Type-check with `tsc --noEmit`       |

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts          # Service worker: approval flow, tab activation, WS relay
│   ├── popup/                 # Setup UI (email, provider, Telegram, detection)
│   ├── upwork.content.ts      # Upwork job detection + proposal filling
│   └── freelancer.content.ts  # Freelancer.com job detection + proposal filling
├── lib/
│   ├── api-client.ts          # Server API client (base URL http://localhost:5000/api)
│   ├── storage.ts             # Session token + config storage
│   ├── types.ts               # Shared types (Job, Proposal, etc.)
│   └── utils.ts               # Helpers (platform matching, URL building)
├── platforms/                 # Upwork / Freelancer adapters
├── components/ui/             # shadcn-style UI components
└── styles.css                 # Tailwind entry
```

> **Note:** content scripts must live directly under `entrypoints/` (`*.content.ts`); placing them in a subfolder causes WXT to silently omit them from the build.

## Related

- Backend API: [AI-Bidder-Server](https://github.com/sisiam08/AI-Bidder-Server)