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
- **Prediction Agent** — 7-day price forecasts for 7 UCITS ETFs via LLM (`qwen3:480b`); computes after-tax return for Moldova residents (12% capital gains), generates Buy/Sell/Hold signals, compares alternatives, and tracks prediction accuracy over time on the `/predictions` page.
- **Mobile-Responsive** — `useIsMobile()` hook drives inline-style conditionals; `/rules` table hides the "Название" column and shrinks padding/inputs below 768px; `/predictions` switches from table to cards on mobile.

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

# Required — Auth.js v5 (authentication)
AUTH_SECRET=your_auth_secret
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_secret

# Optional — restrict login to a single Google account
ALLOWED_EMAIL=your_email@gmail.com

# Optional — Prediction Agent tuning (defaults shown)
SIGNAL_BUY_THRESHOLD_PCT=2.0
SIGNAL_SELL_THRESHOLD_PCT=-2.0
MOLDOVA_CAPITAL_GAINS_TAX=0.12
UCITS_WITHHOLDING_TAX=0.15
PREDICTION_MODEL=qwen3:480b

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

Open [http://localhost:3000](http://localhost:3000) for the dashboard, [http://localhost:3000/rules](http://localhost:3000/rules) for rules management and screenshot upload, or [http://localhost:3000/predictions](http://localhost:3000/predictions) for ETF price predictions.

### First-Time Setup

After starting the dev server, seed the default 7-ETF rules:

```bash
curl -X POST http://localhost:3000/api/init-rules
```

This is idempotent — safe to run multiple times.

To seed the prediction watchlist:

```bash
curl -X POST http://localhost:3000/api/init-watchlist
```

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
| POST   | `/api/init-watchlist`     | One-time seed of 7-ETF watchlist (idempotent)          |
| GET    | `/api/market-data`        | Fetch price history (cache-first, Yahoo fallback)      |
| POST   | `/api/predictions`        | Run prediction pipeline for all watchlist ETFs         |
| GET    | `/api/predictions`        | Latest predictions per symbol with accuracy stats      |
| POST   | `/api/predictions/verify` | Verify past predictions against actual prices          |

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

### `watchlist`

| Column         | Type               | Description                           |
| -------------- | ------------------ | ------------------------------------- |
| `id`           | SERIAL PRIMARY KEY | Auto-generated ID                     |
| `symbol`       | TEXT UNIQUE        | ETF ticker (e.g. `SWRD`)              |
| `yahoo_symbol` | TEXT               | Yahoo Finance ticker (e.g. `SWRD.L`)  |
| `name`         | TEXT               | Human-readable ETF name               |
| `category`     | TEXT               | Category (stock, bond, gold, etc.)    |
| `currency`     | TEXT               | Currency code (USD, EUR)              |
| `dist_policy`  | TEXT               | `acc` or `dist` (distribution policy) |
| `alternatives` | TEXT[]             | Array of alternative ETF symbols      |
| `is_active`    | BOOLEAN            | Whether the ETF is actively tracked   |

### `price_history`

| Column   | Type               | Description       |
| -------- | ------------------ | ----------------- |
| `id`     | SERIAL PRIMARY KEY | Auto-generated ID |
| `symbol` | TEXT               | ETF ticker        |
| `date`   | DATE               | Price date        |
| `close`  | DECIMAL(10,4)      | Closing price     |

Unique constraint on `(symbol, date)`.

### `predictions`

| Column                     | Type               | Description                           |
| -------------------------- | ------------------ | ------------------------------------- |
| `id`                       | SERIAL PRIMARY KEY | Auto-generated ID                     |
| `symbol`                   | TEXT               | ETF ticker                            |
| `target_date`              | DATE               | Date the prediction targets           |
| `horizon_days`             | INTEGER            | Prediction horizon (7)                |
| `current_price`            | DECIMAL(10,4)      | Price at prediction time              |
| `predicted_price`          | DECIMAL(10,4)      | LLM-predicted price                   |
| `direction`                | TEXT               | `up`, `down`, or `flat`               |
| `signal`                   | TEXT               | `buy`, `sell`, or `hold`              |
| `after_tax_return_pct`     | DECIMAL(8,4)       | After-tax return percentage           |
| `baseline_predicted_price` | DECIMAL(10,4)      | SMA-drift baseline price              |
| `actual_price`             | DECIMAL(10,4)      | Actual price (filled on verification) |
| `direction_correct`        | BOOLEAN            | Whether direction was correct         |
| `error_pct`                | DECIMAL(8,4)       | Percentage error                      |
| `mape`                     | DECIMAL(8,4)       | Mean Absolute Percentage Error        |
| `verified_at`              | TIMESTAMP          | Verification timestamp                |
| `created_at`               | TIMESTAMP          | Prediction creation time              |

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
