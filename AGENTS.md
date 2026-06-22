# Project: ETF Rebalancing Agent

## Overview

A personal AI agent for monthly ETF portfolio rebalancing on Interactive Brokers.
The agent analyzes the current portfolio state (loaded from database screenshots),
provides recommendations for distributing new monthly investments based on target
allocations and rules, and generates AI explanations for the recommendations.

## Tech Stack

### Core

- **Framework**: Next.js 16.2.9 (App Router, Turbopack)
- **Language**: TypeScript 5.x (strict mode)
- **UI**: React 19.2.4
- **Package Manager**: npm

### AI Layer

- **LLM Provider**: Ollama Cloud (OpenAI-compatible API)
- **Integration**: Direct `fetch()` to Ollama Cloud (AI SDK v5 removed due to incompatibility)
- **Models**:
  - `qwen3-coder:480b` — text generation (allocation explanations + price predictions)
  - `gemma4:31b-cloud` — vision model (screenshot parsing)

### Data & Storage

- **Database**: PostgreSQL (Neon serverless)
- **Driver**: `pg` 8.21.0 (Node.js PostgreSQL driver)
- **ORM**: None (raw SQL with repository pattern)
- **Vector DB**: pgvector (extension in same Neon DB, planned for v1.1)

### External Services

- **Web Search**: Tavily API (1000 requests/month free tier) — planned
- **Market Data**: Yahoo Finance (free, no API key) — planned
- **Observability**: Langfuse (optional) — planned

### Deployment

- **Hosting**: Vercel (Hobby/Pro plan)
- **Database**: Neon (Free tier)
- **CI/CD**: GitHub Actions (optional)

## Architecture

### FSAA (Feature-Sliced Atomic Architecture)

The project follows strict FSAA rules with these layers:

```
app/        ← Next.js routing, API routes
pages/      ← Page components
features/   ← User-facing features
entities/   ← Business entities
shared/     ← Reusable utilities, UI-kit
```

### Import Rules (STRICT)

- `app/` → can import from `pages`, `features`, `entities`, `shared`
- `pages/` → can import from `features`, `shared` (NOT entities)
- `features/` → can import from `entities`, `shared`
- `entities/` → can import from `shared` only
- `shared/` → cannot import from anything above

> **Note:** `app/api/**` routes are granted an ESLint exception to import from any layer, because API routes are natural composition points in Next.js.

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

| Column        | Type               | Description                                |
| ------------- | ------------------ | ------------------------------------------ |
| `id`          | SERIAL PRIMARY KEY | Auto-generated ID                          |
| `total_value` | DECIMAL(12,2)      | Total portfolio value at snapshot time     |
| `positions`   | JSONB              | `{ symbol: marketValue }`                  |
| `prices`      | JSONB              | `{ symbol: price }` (added via ALTER)      |
| `shares`      | JSONB              | `{ symbol: shareCount }` (added via ALTER) |
| `created_at`  | TIMESTAMP          | Snapshot time                              |

### `watchlist`

| Column         | Type               | Description                          |
| -------------- | ------------------ | ------------------------------------ |
| `id`           | SERIAL PRIMARY KEY | Auto-generated ID                    |
| `symbol`       | TEXT UNIQUE        | ETF ticker (e.g. `SWRD`)             |
| `yahoo_symbol` | TEXT               | Yahoo Finance ticker (e.g. `SWRD.L`) |
| `name`         | TEXT               | Human-readable ETF name              |
| `category`     | TEXT               | Category (stock, bond, gold, etc.)   |
| `currency`     | TEXT               | Currency code (USD, EUR)             |
| `dist_policy`  | TEXT               | `acc` or `dist` (CHECK constraint)   |
| `alternatives` | TEXT[]             | Array of alternative ETF symbols     |
| `is_active`    | BOOLEAN            | Whether the ETF is actively tracked  |

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

## Domain Model

### Portfolio

- **Current portfolio value**: Loaded dynamically from latest DB snapshot
- **Monthly contribution**: variable, entered manually
- **Rebalancing frequency**: monthly
- **Min trade amount**: $50

### ETF Universe (Real 7-ETF Portfolio)

```typescript
const ETF_UNIVERSE = [
  {
    symbol: "SWRD",
    name: "iShares Core MSCI World UCITS ETF",
    targetAllocation: 0.6,
    price: 52.2,
  },
  {
    symbol: "EIMI",
    name: "iShares Core MSCI EM IMI UCITS ETF",
    targetAllocation: 0.05,
    price: 55.0,
  },
  {
    symbol: "DPYA",
    name: "iShares MSCI World Small Cap UCITS ETF",
    targetAllocation: 0.05,
    price: 6.56,
  },
  {
    symbol: "VDTA",
    name: "Vanguard FTSE Developed Europe UCITS ETF",
    targetAllocation: 0.1,
    price: 27.1,
  },
  {
    symbol: "LQDA",
    name: "iShares $ Corp Bond UCITS ETF",
    targetAllocation: 0.1,
    price: 6.32,
  },
  {
    symbol: "IDVY",
    name: "iShares Euro Dividend UCITS ETF",
    targetAllocation: 0.0,
    price: 25.8,
  },
  {
    symbol: "GLDM",
    name: "SPDR Gold MiniShares Trust",
    targetAllocation: 0.1,
    price: 86.76,
  },
];
```

### ETF Prices

Prices are stored in `portfolio_rules.price` and used for share-count calculations.
When a screenshot is parsed, prices and shares are extracted and saved to `portfolio_snapshots`.

## Core Features

### 1. Calculate Allocation

- **Input:** New contribution amount + current portfolio from DB
- **Logic:**
  1. Calculate current weights vs target allocations
  2. Sort ETFs by deviation (most underweight first)
  3. Distribute contribution starting from most underweight
  4. Skip ETFs that don't need rebalancing (min $50)
  5. Round down to whole shares
- **Output:** List of BUY recommendations with shares and amount

### 2. AI Explanation

- **Input:** Recommendations + portfolio state
- **Logic:** Direct fetch to Ollama Cloud with structured prompt
- **Output:** 2-3 sentence explanation in Russian with emojis

### 3. Screenshot Parsing

- **Input:** Screenshot from Interactive Brokers (drag & drop or paste)
- **Logic:** Vision LLM (`gemma4:31b-cloud`) extracts positions, prices, shares
- **Output:** Structured portfolio object saved to `portfolio_snapshots`
- **Location:** `/rules` page

### 4. Portfolio Rules Management

- **Input:** Target allocations and prices per ETF
- **Logic:** CRUD via `/api/portfolio-rules`
- **Output:** Editable rules table with validation
- **Location:** `/rules` page

### 5. Web Search for News (v1.1) — planned

- **Input:** ETF symbol
- **Logic:** Search via Tavily API
- **Output:** News summary + market context

### 6. Prediction Agent

- **Input:** Watchlist of 7 UCITS ETFs (SWRD, EIMI, DPYA, VDTA, LQDA, IDVY, GLDM)
- **Logic:**
  1. Fetch 30-day price history from Yahoo Finance (cached in `price_history` table)
  2. Compute indicators (SMA7, SMA14, volatility, high30, low30)
  3. LLM prediction (`qwen3-coder:480b`) — 7-day price forecast with reasoning
  4. Calculate after-tax return for Moldova resident (12% capital gains, 15% withholding for dist ETFs)
  5. Generate Buy/Sell/Hold signal based on direction + after-tax return
  6. Compare alternatives (threshold: 0.5% improvement)
  7. Baseline: SMA-drift model for accuracy comparison
  8. Verification: compare past predictions against actual prices, track accuracy + MAPE
- **Output:** Predictions table with signal badges, accuracy stats, reasoning (collapsible)
- **Location:** `/predictions` page (desktop table + mobile cards)
- **Tables:** `watchlist`, `price_history`, `predictions`

### 7. Authentication

- **Input:** Google OAuth sign-in (via Auth.js v5 / NextAuth)
- **Logic:**
  - `middleware.ts` protects all routes via the Auth.js `authorized` callback.
  - Unauthenticated users are redirected to `/signin`.
  - `/api/auth/*` routes are excluded from the middleware matcher so NextAuth's own API endpoints (session, providers, callback, etc.) are not intercepted.
  - Optional `ALLOWED_EMAIL` env var restricts login to a single Google account (single-user gate). If unset, any Google account can sign in.
- **Output:** Authenticated session with user avatar/name in the top bar; dropdown menu with navigation links
- **Location:** Per-page header (`UserMenuMolecule` dropdown in `DashboardPage`, `/rules`, and `/predictions` pages). The `/signin` page has no header.

## API Endpoints

### POST /api/chat

Runs allocation calculation directly (bypassing Mastra Tool) and returns recommendations + AI explanation.

**Request:**

```json
{
  "portfolio": {
    "totalValue": 17512.52,
    "positions": { "SWRD": 9998.85, "EIMI": 1202.25, ... }
  },
  "contribution": 700
}
```

**Response:**

```json
{
  "explanation": "Для достижения целевых долей $700 будут распределены так...",
  "recommendations": [
    {
      "symbol": "GLDM",
      "amount": 260.28,
      "shares": 3,
      "currentWeight": 0.088,
      "target": 0.1,
      "newWeight": 0.097
    }
  ]
}
```

````

### GET /api/portfolio-rules

Returns all stored portfolio rules (target allocations and prices).

### POST /api/portfolio-rules

Create or update a portfolio rule.

### POST /api/init-rules

One-time seed of default 7-ETF rules from `ETF_UNIVERSE`. Idempotent.

### POST /api/parse-portfolio

Accepts base64 image, calls vision LLM, parses portfolio, saves snapshot to DB.

**Request:**
```json
{ "image": "data:image/png;base64,iVBORw0KGgo..." }
````

**Response:**

```json
{
  "portfolio": {
    "totalValue": 17512.52,
    "positions": { "SWRD": 9998.85, ... },
    "prices": { "SWRD": 52.43, ... },
    "shares": { "SWRD": 191, ... }
  }
}
```

### GET /api/portfolio-snapshot

Returns the latest saved snapshot (or `null` if none exists).

### POST /api/init-watchlist

One-time seed of the 7-ETF watchlist from `WATCHLIST_SEED`. Idempotent (upsert).

### GET /api/market-data?symbol=SWRD&days=30&force=false

Fetches price history for a symbol. Cache-first: returns from `price_history` table if fresh, otherwise fetches from Yahoo Finance and saves to DB.

**Query params:**

- `symbol` (required) — ETF ticker (e.g. `SWRD`)
- `days` (default 30) — number of days of history
- `force` (default false) — bypass cache and fetch from Yahoo

**Response:**

```json
{
  "symbol": "SWRD",
  "prices": [{ "date": "2025-05-23", "close": 52.43 }, ...],
  "source": "cache"
}
```

### POST /api/predictions

Runs the full prediction pipeline for all active watchlist ETFs: fetch history → compute indicators → LLM prediction → after-tax return → signal → alternatives → save to DB.

**Response:**

```json
{
  "predictions": [{ "symbol": "SWRD", "predictedPrice": 53.1, "signal": "buy", ... }],
  "count": 7,
  "savedIds": [1, 2, 3, ...]
}
```

### GET /api/predictions?limit=50

Returns the latest prediction per symbol (DISTINCT ON symbol) with accuracy stats.

### POST /api/predictions/verify

Verifies unverified predictions against actual prices (from DB or Yahoo fallback). Updates `predictions` table with `actual_price`, `direction_correct`, `error_pct`, `mape`.

**Response:**

```json
{
  "verified": 5,
  "accuracy": 0.6,
  "avgMape": 2.35,
  "directionCorrect": 3,
  "total": 5
}
```

## Environment Variables

```bash
# Required — Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require

# Required — AI
OLLAMA_API_KEY=your_ollama_cloud_key

# Required — Auth.js v5 (authentication)
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_auth_secret
# Google OAuth credentials (https://console.cloud.google.com)
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret

# Optional — restrict login to a single Google account (recommended)
ALLOWED_EMAIL=your_email@gmail.com
# Optional — app base URL (auto-detected on Vercel, set for local dev)
NEXTAUTH_URL=http://localhost:3000

# Google Cloud Console OAuth settings
# Authorized JavaScript origins:
#   - http://localhost:3000
#   - https://<your-vercel-domain>.vercel.app
# Authorized redirect URIs:
#   - http://localhost:3000/api/auth/callback/google
#   - https://<your-vercel-domain>.vercel.app/api/auth/callback/google

# Optional (v1.1)
TAVILY_API_KEY=your_tavily_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts # NextAuth route handler
│   │   ├── chat/route.ts              # Allocation + AI explanation
│   │   ├── init-rules/route.ts        # Seed default rules
│   │   ├── parse-portfolio/route.ts   # Vision LLM screenshot parser
│   │   ├── portfolio-rules/route.ts   # CRUD for rules
│   │   ├── portfolio-snapshot/route.ts # GET latest snapshot
│   │   ├── init-watchlist/route.ts    # Seed 7-ETF watchlist
│   │   ├── market-data/route.ts       # Yahoo Finance price history (cache-first)
│   │   ├── predictions/route.ts       # POST pipeline + GET latest predictions
│   │   └── predictions/verify/route.ts # Verify past predictions
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── rules/page.tsx                 # Rules + upload page
│   └── predictions/page.tsx           # Prediction agent page
│
├── pages/
│   ├── _app.tsx                       # Pages Router SessionProvider wrapper
│   └── dashboard/
│       ├── DashboardPage.tsx          # Main dashboard (input + portfolio + AI)
│       └── index.ts
│
├── features/
│   ├── calculate-allocation/
│   │   ├── agent.ts                   # Mastra Agent definition
│   │   ├── api/calculate.ts           # Feature API wrapper
│   │   ├── ui/AllocationHeader.tsx    # Input form header
│   │   └── ui/CalculateAllocationFeature.tsx
│   ├── ai-explanation/
│   │   ├── api/explain.ts             # Direct Ollama fetch
│   │   └── ui/AIExplanationFeature.tsx
│   ├── portfolio-rules/
│   │   ├── api/rules.ts               # Rules CRUD API
│   │   └── ui/PortfolioRulesFeature.tsx
│   └── portfolio-upload/
│       ├── api/parse.ts               # Screenshot parsing logic
│       └── ui/PortfolioUploadFeature.tsx
│   └── predictions/
│       ├── agent.ts                   # Mastra Agent (tools composition)
│       ├── api/predictions.ts         # Client wrapper: fetch/create predictions
│       ├── api/verify.ts              # Client wrapper: verify predictions
│       ├── api/marketData.ts          # Client wrapper: fetch market data
│       ├── ui/PredictionHeaderMolecule.tsx  # Header + action buttons + disclaimer
│       ├── ui/PredictionTableMolecule.tsx   # Desktop table (9 columns, sortable)
│       ├── ui/PredictionCardMolecule.tsx    # Mobile card (compact grid)
│       └── ui/PredictionsFeature.tsx        # Feature composition (desktop/mobile)
│
├── entities/
│   ├── etf/
│   │   ├── index.ts                   # Public API
│   │   └── model/
│   │       ├── etfTypes.ts            # TypeScript interfaces
│   │       ├── etfRules.ts            # Pure business logic (calculateAllocation)
│   │       └── allocationTool.ts      # Mastra Tool (legacy)
│   ├── portfolio/
│   │   ├── index.ts                   # Public API
│   │   └── model/
│   │       ├── portfolioRepository.ts # DB CRUD for rules + snapshots
│   │       └── parseScreenshotTool.ts # Vision LLM tool definition
│   ├── market-data/
│   │   ├── index.ts                   # Public API
│   │   └── model/
│   │       ├── watchlistRepository.ts # DB CRUD for watchlist
│   │       ├── watchlistSeed.ts       # 7-ETF seed data (yahoo_symbol, alternatives)
│   │       ├── priceHistoryRepository.ts # DB CRUD for price_history
│   │       ├── yahooFinanceClient.ts  # Yahoo Finance API client (fetch + retry)
│   │       ├── yahooHistoryTool.ts    # Mastra Tool: get-price-history
│   │       └── marketDataTypes.ts     # YahooFinanceError, YahooRange types
│   └── prediction/
│       ├── index.ts                   # Public API
│       └── model/
│           ├── predictionRepository.ts    # DB CRUD for predictions
│           ├── predictionBaselines.ts     # randomWalk + smaDrift baselines
│           ├── predictionTypes.ts         # PredictionInput, LLMResponse, PredictionResult
│           ├── predictionTax.ts           # After-tax return (Moldova 12% + withholding)
│           ├── predictionSignals.ts       # Buy/Sell/Hold signal + labels + colors
│           ├── predictionEngine.ts        # LLM prediction (callOllamaChat)
│           ├── predictionEngineTool.ts    # Mastra Tool: predict-price
│           ├── predictionTaxTool.ts       # Mastra Tool: calc-after-tax-return
│           ├── predictionSignalTool.ts    # Mastra Tool: calc-signal
│           ├── predictionAlternatives.ts  # findBestAlternative (0.5% threshold)
│           └── predictionAccuracy.ts      # verifyPrediction + calcAccuracyStats
│
└── shared/
    ├── atoms/
    │   ├── BadgeAtom/                 # Status badges (Недодан, Перевес, etc.)
    │   ├── ButtonAtom/
    │   ├── CardAtom/
    │   ├── InputAtom/
    │   └── ProgressBarAtom/
    ├── molecules/
│   ├── AIExplanationMolecule/
│   ├── PortfolioPositionMolecule/   # ETF card with Excel-style row (Кол-во/Цена/Сумма)
│   ├── RecommendationItemMolecule/
│   └── UserMenuMolecule/             # Dropdown menu: Dashboard/Rules/Predictions/Sign out (Google OAuth)
    ├── lib/
    │   ├── auth.ts                   # Auth.js v5 config (Google provider, single-user gate)
    │   ├── SessionProvider.tsx       # Client-side session context wrapper
    │   ├── db.ts                      # PostgreSQL pool (pg)
    │   ├── mastra.ts                  # Mastra instance factory
    │   ├── migrations.ts             # Schema creation + ALTER TABLE (rules, snapshots, watchlist, price_history, predictions)
    │   ├── ollama.ts                  # Ollama configuration + callOllamaChat helper
    │   ├── predictionConfig.ts        # Prediction config: thresholds, tax rates, model name
    │   └── useMediaQuery.ts           # SSR-safe responsive hook (useIsMobile)
    │
    ├── middleware.ts                  # Auth.js route protection; excludes /api/auth/*
    └── ui/tokens/
        ├── breakpoints.ts
        ├── colors.ts
        ├── spacing.ts
        ├── typography.ts
        └── zIndex.ts
```

## Design System

### Colors

- **Brand:** Blue (#3b82f6) — primary actions
- **Success:** Green (#22c55e) — BUY actions, on-target positions
- **Danger:** Red (#ef4444) — SELL actions, overweight warnings
- **Warning:** Orange (#f59e0b) — rebalance needed, underweight positions
- **Info:** Light blue (#eff6ff) — AI explanation block

### Typography

- **Font family:** Inter, system-ui, -apple-system, sans-serif
- **Sizes:** xs (12px) → 5xl (48px)
- **Weights:** regular, medium, semibold, bold

### Layout

- **Dashboard:** Two-column on desktop (input + AI explanation), full-width portfolio below
- **Mobile:** Single column, responsive grid for ETF cards (`auto-fill minmax(280px, 1fr)`)
- **Cards:** White background, rounded corners (0.5-0.75rem), subtle shadow

### Responsive Strategy

- **Hook:** `useIsMobile()` (from `shared/lib/useMediaQuery.ts`) — SSR-safe, returns `true` when viewport < `md` (768px). Reads values from `breakpoints.ts`.
- **Approach:** Inline-style conditionals keyed on `isMobile` (no Tailwind, no CSS media queries in components) — preserves the design-token convention.
- **`/rules` page (mobile):**
  - Container padding reduced (`spacing[3]`/`spacing[2]` vs `spacing[6]`/`spacing[4]`)
  - Portfolio header stacks vertically (`flex-direction: column`)
  - Rules table: "Название" column hidden, cell padding `spacing[2]`, input widths shrunk (64px/72px vs 80px/100px)
  - Upload drag-zone padding `spacing[5]` (vs `spacing[8]`), icon 36px (vs 48px)
- **Portfolio grid:** `minmax(280px, 1fr)` already yields one column on phones — unchanged.

## Rebalancing Rules (Knowledge Base)

Target allocations are stored in the `portfolio_rules` table and loaded at runtime. The calculation engine falls back to hardcoded `ETF_UNIVERSE` values if the database is unavailable.

1. Maintain target allocation ±5%
2. New money → most underweight ETF
3. Min trade: $50 (avoid small trades with high fees)
4. Stocks:Bonds ratio = 90:10 (long-term growth)
5. International (EIMI + VDTA): ~15% (diversification)
6. Prefer new money over selling (tax efficiency)
7. Continue buying during market downturns (don't catch the bottom)

### Current Target Allocations (from DB)

| Symbol | Name                                     | Target |
| ------ | ---------------------------------------- | ------ |
| SWRD   | iShares Core MSCI World UCITS ETF        | 60%    |
| EIMI   | iShares Core MSCI EM IMI UCITS ETF       | 5%     |
| DPYA   | iShares MSCI World Small Cap UCITS ETF   | 5%     |
| VDTA   | Vanguard FTSE Developed Europe UCITS ETF | 10%    |
| LQDA   | iShares $ Corp Bond UCITS ETF            | 10%    |
| IDVY   | iShares Euro Dividend UCITS ETF          | 0%     |
| GLDM   | SPDR Gold MiniShares Trust               | 10%    |

## Coding Conventions

- Absolute imports: Use `@/` alias
- File naming: PascalCase for components, camelCase for utilities
- Exports: Always through `index.ts` (public API)
- TypeScript: Strict mode, no `any` types
- Comments: JSDoc for public functions, Russian UI labels
- Error handling: Try-catch in API routes, graceful degradation
- Styling: CSS-in-JS inline styles using design tokens (no Tailwind classes in components)
- **Server/Client boundary:** `pg` driver is server-only; client components never import it directly

## Current Status

### ✅ Done (MVP)

- Basic UI with form
- Portfolio display with progress bars and Excel-style cards (Кол-во / Цена / Сумма)
- Allocation calculation (deterministic, DB-backed portfolio)
- AI explanation via direct Ollama Cloud fetch
- FSAA structure under `src/`
- Modern design tokens and components
- Path aliases and build passing
- FSAA ESLint rules with `app/api/**` exception
- Mastra agent and tool setup
- Real 7-ETF portfolio data
- Neon PostgreSQL connection (`pg` driver)
- `portfolio_rules` schema and migrations
- `portfolio_snapshots` schema with `prices` and `shares` JSONB columns
- Repository layer for portfolio rules and snapshots
- API routes: `/api/portfolio-rules`, `/api/init-rules`, `/api/parse-portfolio`, `/api/portfolio-snapshot`
- DB-backed target allocations with fallback to hardcoded values
- Screenshot parsing with vision LLM (`gemma4:31b-cloud`)
- Drag-and-drop upload on `/rules` page
- Rules editing UI on `/rules` page
- Dashboard loads latest snapshot from DB automatically
- Mobile-friendly responsive layout
- Authentication via Auth.js v5 (Google OAuth, single-user gate, middleware protection)
- Custom `/signin` page without header
- `UserMenuMolecule` dropdown menu (Dashboard / Rules / Predictions / Sign out) on protected pages
- Middleware excludes `/api/auth/*` to prevent Auth.js endpoint interception
- Prediction Agent: 7-day LLM price forecasts (`qwen3:480b`) for 7 UCITS ETFs
- Yahoo Finance price history integration (cache-first in `price_history` table)
- After-tax return calculation for Moldova residents (12% capital gains + 15% withholding for dist ETFs)
- Buy/Sell/Hold signals with configurable thresholds
- SMA-drift baseline model for accuracy comparison
- Prediction verification pipeline (direction accuracy + MAPE tracking)
- Alternative ETF comparison (0.5% improvement threshold)
- `/predictions` page with desktop table (sortable) and mobile cards
- `watchlist`, `price_history`, `predictions` database tables
- API routes: `/api/init-watchlist`, `/api/market-data`, `/api/predictions`, `/api/predictions/verify`

### 🔄 In Progress

- (none — prediction agent MVP complete)

### 📋 TODO (v1.1)

- Web search for news (Tavily)
- RAG with pgvector
- Monitoring with Langfuse
- Yahoo Finance price auto-update (scheduled job)

> **Note:** Vercel deployment requires adding all environment variables in the Vercel dashboard and updating Google Cloud Console OAuth origins/redirect URIs for the production domain.

## Important Constraints

1. No real money transactions — this is advisory only
2. No IB API integration yet — manual screenshot upload
3. Single user — Google OAuth gate via `ALLOWED_EMAIL` (no multi-tenancy, no user_id in DB)
4. Russian language UI — but code/comments in English
5. `pg` driver is server-only; client components never import it directly
6. AI SDK removed — using direct `fetch()` to Ollama Cloud due to v5 incompatibility
