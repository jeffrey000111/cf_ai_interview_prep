# cf_ai_interview_prep

An AI-powered interview preparation assistant built on Cloudflare Workers AI. Paste a job description, get tailored interview questions, practice your answers, and receive real-time STAR-framework feedback — all with persistent session memory powered by Durable Objects.

## Live Demo

> Deploy instructions below — run locally in under 2 minutes.

## Features

- **JD-Aware Question Generation** — Paste any job description and get 7 tailored questions: 3 behavioral, 2 technical, 2 situational
- **Real-Time Answer Feedback** — AI evaluates your answers using the STAR framework (Situation, Task, Action, Result), pointing out strengths and gaps
- **Persistent Session Memory** — Durable Objects store your full conversation history so context is never lost between messages; pick up where you left off
- **Multi-Turn Coaching** — The AI tracks which questions you've practiced, avoids repetition, and adjusts feedback based on your running performance in the session
- **Clean Chat Interface** — Minimal, fast UI served directly from the Worker

## Architecture

```
Browser → Cloudflare Worker (src/index.ts)
               │
               ├── /api/* → Durable Object: InterviewSession (src/agent.ts)
               │               ├── /init   — generate questions via Workers AI LLM
               │               ├── /chat   — multi-turn coaching with full history
               │               ├── /state  — restore session on page reload
               │               └── /reset  — clear session and start over
               │
               └── /* → Static HTML (served inline from Worker)
```

**Why Durable Objects?**
Each user session maps to a named Durable Object instance. This gives us:
- Strongly consistent, zero-latency state reads (no external DB roundtrip)
- Automatic session rehydration on page reload
- Isolated state per user — no shared-memory race conditions
- Edge-native persistence without managing infrastructure

**LLM:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI binding

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Wrangler CLI

### Local Development

```bash
# Clone and install
git clone https://github.com/jeffrey000111/cf_ai_interview_prep
cd cf_ai_interview_prep
npm install

# Run locally (Workers AI available in local dev with --remote flag)
npx wrangler dev --remote
```

Open `http://localhost:8787` in your browser.

### Deploy to Cloudflare

```bash
npx wrangler deploy
```

That's it. Wrangler handles the Durable Object migration and Workers AI binding automatically.

## Usage

1. Paste a job description into the text area
2. Click **Generate Interview Questions** — the AI analyzes the JD and generates 7 targeted questions
3. Type your answer to any question in the chat
4. Receive structured feedback: what you did well, what was missing, how to improve
5. Keep practicing — the AI remembers your full session and tracks progress
6. Click **New Session** to start fresh with a different JD

## Project Structure

```
cf_ai_interview_prep/
├── src/
│   ├── index.ts      # Worker entry point, request routing, static HTML
│   └── agent.ts      # Durable Object: session state, LLM calls
├── wrangler.toml     # Cloudflare Workers config
├── tsconfig.json
├── PROMPTS.md        # All AI prompts used in this project
└── README.md
```

## Built With

- [Cloudflare Workers](https://workers.cloudflare.com/) — serverless edge runtime
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — LLM inference at the edge
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) — stateful session persistence
- TypeScript
