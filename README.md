# ETF Rebalancing Agent

A personal AI agent for monthly ETF portfolio rebalancing on Interactive Brokers.
The agent analyzes the current portfolio state (loaded from database screenshots),
provides recommendations for distributing new monthly investments based on target
allocations and rules, and generates AI explanations for the recommendations.

## Tech Stack

| Layer       | Technology                                                     |
| ----------- | -------------------------------------------------------------- |
| Framework   | Next.js 16.2.9 (App Router, Turbopack)                         |
| Language    | TypeScript 5.x (strict mode)                                   |
| UI          | React 19.2.4                                                   |
| AI (text)   | Ollama Cloud — `qwen3-coder:480b` (allocation explanations)    |
| AI (vision) | Ollama Cloud — `gemma4:31b-cloud` (screenshot parsing)         |
| Database    | PostgreSQL (Neon serverless) via `pg` 8.21.0 (raw SQL, no ORM) |
| Package Mgr | npm                                                            |

## Features

- **Allocation Calculation** — deterministic engine: sorts ETFs by deviation from target, distributes contribution starting from most underweight, rounds down to whole shares, skips sub-$50 trades.
- **AI Explanation** — 2–3 sentence Russian summary of recommendations via direct `fetch()` to Ollama Cloud.
- **Screenshot Parsing** — drag-and-drop or paste an Interactive Brokers screenshot; vision LLM extracts positions, prices, and shares; saves snapshot to DB.
- **Portfolio Rules Management** — CRUD for target allocations and prices per ETF on the `/rules` page.
- **Mobile-Responsive** — `useIsMobile()` hook drives inline-style conditionals; `/rules` table hides the "Название" column and shrinks padding/inputs below 768px.

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon PostgreSQL database (or any `pg`-compatible server)
- An Ollama Cloud API key

### Environment Variables

Create `.env.local` in the project root:

```bash
# Required
OLLAMA_API_KEY=your_ollama_cloud_key
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require

# Optional (v1.1)
TAVILY_API_KEY=your_tavily_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard, or [http://localhost:3000/rules](http://localhost:3000/rules) for rules management and screenshot upload.

### First-Time Setup

After starting the dev server, seed the default 7-ETF rules:

```bash
curl -X POST http://localhost:3000/api/init-rules
```

This is idempotent — safe to run multiple times.

## ETF Universe

| Symbol | Name                                     | Target |
| ------ | ---------------------------------------- | ------ |
| SWRD   | iShares Core MSCI World UCITS ETF        | 60%    |
| EIMI   | iShares Core MSCI EM IMI UCITS ETF       | 5%     |
| DPYA   | iShares MSCI World Small Cap UCITS ETF   | 5%     |
| VDTA   | Vanguard FTSE Developed Europe UCITS ETF | 10%    |
| LQDA   | iShares $ Corp Bond UCITS ETF            | 10%    |
| IDVY   | iShares Euro Dividend UCITS ETF          | 0%     |
| GLDM   | SPDR Gold MiniShares Trust               | 10%    |

## API Endpoints

| Method | Path                      | Description                                            |
| ------ | ------------------------- | ------------------------------------------------------ |
| POST   | `/api/chat`               | Allocation calculation + AI explanation                |
| GET    | `/api/portfolio-rules`    | Returns all stored portfolio rules                     |
| POST   | `/api/portfolio-rules`    | Create or update a portfolio rule                      |
| POST   | `/api/init-rules`         | One-time seed of default 7-ETF rules (idempotent)      |
| POST   | `/api/parse-portfolio`    | Accepts base64 image, calls vision LLM, saves snapshot |
| GET    | `/api/portfolio-snapshot` | Returns the latest saved snapshot (or `null`)          |

## Architecture (FSAA)

The project follows Feature-Sliced Atomic Architecture with strict import rules:

```
app/        ← Next.js routing, API routes
pages/      ← Page components
features/   ← User-facing features
entities/   ← Business entities
shared/     ← Reusable utilities, UI-kit
```

**Import rules:** `app → pages → features → entities → shared` (each layer may only import from layers below it; `app/api/**` is exempted as a composition point).

## Database Schema

### `portfolio_rules`

| Column          | Type               | Description                                 |
| --------------- | ------------------ | ------------------------------------------- |
| `id`            | SERIAL PRIMARY KEY | Auto-generated ID                           |
| `symbol`        | TEXT UNIQUE        | ETF ticker (e.g. `SWRD`)                    |
| `name`          | TEXT               | Human-readable ETF name                     |
| `target_weight` | DECIMAL(5,4)       | Target allocation as fraction (e.g. `0.60`) |
| `price`         | DECIMAL(10,2)      | Latest known price (optional)               |
| `created_at`    | TIMESTAMP          | Rule creation time                          |
| `updated_at`    | TIMESTAMP          | Last update time                            |

### `portfolio_snapshots`

| Column        | Type               | Description                            |
| ------------- | ------------------ | -------------------------------------- |
| `id`          | SERIAL PRIMARY KEY | Auto-generated ID                      |
| `total_value` | DECIMAL(12,2)      | Total portfolio value at snapshot time |
| `positions`   | JSONB              | `{ symbol: marketValue }`              |
| `prices`      | JSONB              | `{ symbol: price }`                    |
| `shares`      | JSONB              | `{ symbol: shareCount }`               |
| `created_at`  | TIMESTAMP          | Snapshot time                          |

## Rebalancing Rules

1. Maintain target allocation ±5%
2. New money → most underweight ETF
3. Min trade: $50 (avoid small trades with high fees)
4. Stocks:Bonds ratio = 90:10 (long-term growth)
5. International (EIMI + VDTA): ~15% (diversification)
6. Prefer new money over selling (tax efficiency)
7. Continue buying during market downturns (don't catch the bottom)

## Build

```bash
npm run build
```

## Roadmap (v1.1)

- Web search for ETF news (Tavily API)
- RAG with pgvector
- Deploy to Vercel
- Monitoring with Langfuse
- Yahoo Finance price auto-update

## Constraints

- No real money transactions — advisory only
- No IB API integration — manual screenshot upload
- Single user — no authentication in MVP
- Russian language UI; code and comments in English
- `pg` driver is server-only; client components never import it directly
