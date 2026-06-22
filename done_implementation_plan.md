# Реализованные задачи: Prediction Agent

> Журнал выполненных задач из `IMPLEMENTATION_PLAN.md`.
> Обновляется после каждого этапа.

---

## Этап 0 — Подготовка и конфигурация ✅

### Task 0.1 ✅ — `predictionConfig.ts`

**Файл:** `src/shared/lib/predictionConfig.ts` (новый)

**Что сделано:**

- Создан типизированный модуль конфигурации для Prediction Agent.
- Интерфейсы: `SignalThresholds`, `TaxConfig`, `OllamaConfig`, `YahooConfig`, `PredictionConfig`.
- Экспортируется singleton-объект `predictionConfig` с полями:
  - `signalThresholds.buy` (env `SIGNAL_BUY_THRESHOLD_PCT`, default `2.0`)
  - `signalThresholds.sell` (env `SIGNAL_SELL_THRESHOLD_PCT`, default `-2.0`)
  - `tax.capitalGains` (env `MOLDOVA_CAPITAL_GAINS_TAX`, default `0.12`)
  - `tax.withholding` (env `UCITS_WITHHOLDING_TAX`, default `0.15`)
  - `ollama.baseURL` (env `OLLAMA_BASE_URL`, default `https://ollama.com`)
  - `ollama.apiKey` (env `OLLAMA_API_KEY`)
  - `ollama.predictionModel` (env `PREDICTION_MODEL`, default `qwen3:480b`)
  - `yahoo.userAgent` (env `YAHOO_FINANCE_USER_AGENT`, default `Mozilla/5.0`)
- Хелперы `parseFloatEnv()` и `parseStringEnv()` для безопасного парсинга env.
- Экспортирована функция `getSignalThresholds(): SignalThresholds`.
- Все значения парсятся через `parseFloat` / `String` с fallback на default.
- No `any` типов, strict mode проходит.

**FSAA:** `shared/lib/` → нет импортов из верхних слоёв. ✅

---

### Task 0.2 ✅ — Расширение `ollama.ts` для прямого fetch

**Файл:** `src/shared/lib/ollama.ts` (существующий — расширен)

**Что сделано:**

- Существующий код (`ollamaConfig`, `ollama` через `@ai-sdk/openai`) **не тронут** — используется в `features/calculate-allocation/agent.ts`.
- Добавлен интерфейс `ChatMessage` (`role: "system" | "user" | "assistant"`, `content: string`).
- Добавлена функция `callOllamaChat(model: string, messages: ChatMessage[]): Promise<string>`:
  - Использует `predictionConfig.ollama.baseURL` и `apiKey`.
  - POST на `/v1/chat/completions` (OpenAI-compatible endpoint).
  - Заголовок `Authorization: Bearer ${apiKey}`.
  - `temperature: 0.3`, `stream: false`.
  - Парсит `choices[0].message.content`.
  - Бросает `Error` при missing API key, HTTP ошибке, malformed response.
- Импорт `predictionConfig` из `./predictionConfig` (оба в `shared/lib/` — корректно).

**Проверка:** `agent.ts` не сломан — `ollamaConfig` всё ещё экспортируется. ✅

**FSAA:** `shared/lib/` → импорт только из `shared/lib/`. ✅

---

### Итог этапа 0

| Task | Файл                                 | Статус |
| ---- | ------------------------------------ | ------ |
| 0.1  | `src/shared/lib/predictionConfig.ts` | ✅     |
| 0.2  | `src/shared/lib/ollama.ts`           | ✅     |

**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 1 — База данных и миграции ✅

### Task 1.1 ✅ — Миграции: 3 новые таблицы

**Файл:** `src/shared/lib/migrations.ts` (расширен)

**Что сделано:**

- В `runMigrations()` добавлены 3 таблицы + 3 индекса:
  1. **`watchlist`** — ETF watchlist с полями: `symbol` (UNIQUE), `yahoo_symbol`, `name`, `category`, `currency`, `dist_policy` (CHECK acc/dist), `alternatives TEXT[]`, `is_active`, timestamps.
  2. **`price_history`** — `symbol`, `date`, `close DECIMAL(12,4)`, `UNIQUE(symbol, date)`. Индекс `idx_price_history_symbol_date` на `(symbol, date DESC)`.
  3. **`predictions`** — полная схема: `symbol`, `target_date`, `horizon_days`, `currency`, `current_price`, `predicted_price`, `confidence`, `direction` (CHECK up/down/flat), `reasoning`, `after_tax_return_pct`, `signal` (CHECK buy/sell/hold), `alternative_symbol`, `alternative_after_tax_return_pct`, `baseline_predicted_price`, `baseline_direction`, `actual_price`, `actual_direction`, `direction_correct`, `error_pct`, `mape`, `verified_at`, `created_at`. Индексы: `idx_predictions_symbol_created`, `idx_predictions_unverified` (partial WHERE verified_at IS NULL).
- Все `CREATE TABLE` / `CREATE INDEX` с `IF NOT EXISTS` — идемпотентно.

---

### Task 1.2 ✅ — `watchlistRepository.ts`

**Файлы:**

- `src/entities/market-data/model/watchlistRepository.ts` (новый)
- `src/entities/market-data/index.ts` (новый — public API)

**Что сделано:**

- Интерфейсы: `WatchlistItem` (full record), `WatchlistItemInput` (for upsert).
- Функции:
  - `getActiveWatchlist(): Promise<WatchlistItem[]>` — все активные, ORDER BY symbol.
  - `getWatchlistBySymbol(symbol): Promise<WatchlistItem | null>`.
  - `upsertWatchlistItem(item: WatchlistItemInput): Promise<void>` — INSERT ... ON CONFLICT (symbol) DO UPDATE.
- `mapRow()` хелпер для конвертации DB row → WatchlistItem (Number() для DECIMAL, Boolean() для is_active).
- Паттерн идентичен `portfolioRepository.ts` — `query` из `@/shared/lib/db`.

**FSAA:** `entities/market-data` → импорт только из `@/shared/lib/db`. ✅

---

### Task 1.3 ✅ — `priceHistoryRepository.ts` + shared тип `PricePoint`

**Файлы:**

- `src/shared/types/marketData.ts` (новый — `PricePoint` interface)
- `src/entities/market-data/model/priceHistoryRepository.ts` (новый)
- `src/entities/market-data/index.ts` (обновлён)

**Что сделано:**

- `PricePoint` interface (`{ date: string; close: number }`) живёт в `shared/types/marketData.ts` — доступен обоим entity-слоям без cross-entity импорта.
- Функции:
  - `savePriceBatch(symbol, prices: PricePoint[]): Promise<void>` — один multi-row INSERT с ON CONFLICT (symbol, date) DO UPDATE.
  - `getPriceHistory(symbol, days): Promise<PricePoint[]>` — последние N дней, сортировка ASC.
  - `getPriceOnDate(symbol, date): Promise<PricePoint | null>` — для верификации.
  - `getLatestPriceDate(symbol): Promise<string | null>` — проверка свежести кэша.
- Date конвертация: `Date → ISO slice(0,10)` или `String()`.

**FSAA:** `entities/market-data` → импорт из `@/shared/lib/db` + `@/shared/types/marketData`. ✅

---

### Task 1.4 ✅ — `predictionRepository.ts`

**Файлы:**

- `src/entities/prediction/model/predictionRepository.ts` (новый)
- `src/entities/prediction/index.ts` (новый — public API)

**Что сделано:**

- Типы: `Direction`, `Signal`, `PredictionRecord` (все поля таблицы), `PredictionInput` (для save), `VerificationResult`.
- Функции:
  - `savePrediction(p: PredictionInput): Promise<number>` — возвращает id.
  - `getLatestPredictions(limit): Promise<PredictionRecord[]>` — `DISTINCT ON (symbol)` + ORDER BY created_at DESC (одна запись на символ).
  - `getUnverifiedPredictions(): Promise<PredictionRecord[]>` — WHERE verified_at IS NULL AND target_date <= CURRENT_DATE.
  - `getPredictionsBySymbol(symbol, limit): Promise<PredictionRecord[]>`.
  - `markVerified(id, actual: VerificationResult): Promise<void>` — обновляет actual_price, actual_direction, direction_correct, error_pct, mape, verified_at.
- `mapRow()` + `formatDate()` хелперы для конвертации DB типов.

**FSAA:** `entities/prediction` → импорт только из `@/shared/lib/db`. ✅ (cross-entity импорт в `entities/market-data` отсутствует)

---

### Task 1.5 ✅ — Seed watchlist + `/api/init-watchlist`

**Файлы:**

- `src/entities/market-data/model/watchlistSeed.ts` (новый)
- `src/app/api/init-watchlist/route.ts` (новый)
- `src/entities/market-data/index.ts` (обновлён — добавлен WATCHLIST_SEED экспорт)

**Что сделано:**

- `WATCHLIST_SEED` — массив 7 ETF с исправленными `yahoo_symbol`:
  - SWRD → SWRD.L, EIMI → EIMI.L, DPYA → DPYA.L, VDTA → VDTA.L, LQDA → LQDA.L, IDVY → IDVY.L, GLDM → GLDM (US).
  - Каждый с `category`, `currency`, `distPolicy`, `alternatives[]`.
- `POST /api/init-watchlist` — idempotent: runMigrations → upsert каждого item → возвращает watchlist.
- Паттерн как `/api/init-rules/route.ts`.

**FSAA:** `app/api/**` → ESLint exception, импортирует из entities. ✅

---

### Итог этапа 1

| Task | Файлы                                                                                        | Статус |
| ---- | -------------------------------------------------------------------------------------------- | ------ |
| 1.1  | `src/shared/lib/migrations.ts`                                                               | ✅     |
| 1.2  | `src/entities/market-data/model/watchlistRepository.ts`, `index.ts`                          | ✅     |
| 1.3  | `src/shared/types/marketData.ts`, `src/entities/market-data/model/priceHistoryRepository.ts` | ✅     |
| 1.4  | `src/entities/prediction/model/predictionRepository.ts`, `index.ts`                          | ✅     |
| 1.5  | `src/entities/market-data/model/watchlistSeed.ts`, `src/app/api/init-watchlist/route.ts`     | ✅     |

**Новых файлов:** 8
**Изменённых файлов:** 2 (`migrations.ts`, `market-data/index.ts` создан и обновлён)
**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 2 — Источник данных (Yahoo Finance) ✅

### Task 2.1 ✅ — `yahooFinanceClient.ts` + `marketDataTypes.ts`

**Файлы:**

- `src/entities/market-data/model/marketDataTypes.ts` (новый — `YahooFinanceError` class)
- `src/entities/market-data/model/yahooFinanceClient.ts` (новый)
- `src/entities/market-data/index.ts` (обновлён — добавлены экспорты)

**Что сделано:**

- `YahooFinanceError` — кастомный Error class с `statusCode` и `symbol` полями.
- `fetchPriceHistory(yahooSymbol, range: YahooRange, interval): Promise<PricePoint[]>`:
  - Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=...&interval=...`
  - Заголовок `User-Agent` из `predictionConfig.yahoo.userAgent`.
  - Парсинг `chart.result[0].timestamp` + `indicators.adjClose[0].adjclose`.
  - Конвертация Unix timestamp → ISO date `YYYY-MM-DD`.
  - Возвращает пустой массив если данных нет (не null).
- `fetchQuote(yahooSymbol): Promise<YahooQuote>` — текущая цена + валюта через `range=1d`.
- Retry-логика: при 403/429 — один retry через 2 сек, потом `YahooFinanceError`.
- Сетевые ошибки и invalid JSON обёрнуты в `YahooFinanceError`.
- Типы: `YahooRange`, `YahooQuote` экспортируются.

**FSAA:** `entities/market-data` → импорт из `@/shared/lib/predictionConfig` + `@/shared/types/marketData`. ✅

---

### Task 2.2 ✅ — `GET /api/market-data`

**Файл:** `src/app/api/market-data/route.ts` (новый)

**Что сделано:**

- Query params: `symbol` (обязательный), `days` (default 30, min 1), `force` (default false).
- Flow:
  1. `getWatchlistBySymbol(symbol)` → 404 если не найден.
  2. Если `force=false` и `getLatestPriceDate(symbol)` == сегодня → вернуть из БД (`source: "cache"`).
  3. Иначе `fetchPriceHistory(yahooSymbol, range)` → `savePriceBatch` → вернуть (`source: "yahoo"`).
  4. `range`: `days <= 30` → `"30d"`, иначе `"1y"`.
- Response: `{ symbol, days, prices: PricePoint[], source: "cache" | "yahoo" }`.
- Обработка ошибок: `YahooFinanceError` → 502, прочие → 500.

**FSAA:** `app/api/**` → ESLint exception, импортирует из entities. ✅

---

### Итог этапа 2

| Task | Файлы                                                                | Статус |
| ---- | -------------------------------------------------------------------- | ------ |
| 2.1  | `marketDataTypes.ts`, `yahooFinanceClient.ts`, `index.ts` (обновлён) | ✅     |
| 2.2  | `src/app/api/market-data/route.ts`                                   | ✅     |

**Новых файлов:** 3
**Изменённых файлов:** 1 (`market-data/index.ts`)
**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 3 — Backtest (baseline-модель) ✅

### Task 3.1 ✅ — `backtest_seed.ts` (загрузка 1 года истории)

**Файл:** `scripts/backtest_seed.ts` (новый, вне `src/`)

**Что сделано:**

- Node.js скрипт для запуска через `npx tsx scripts/backtest_seed.ts`.
- Для каждого тикера из `WATCHLIST_SEED`:
  1. `fetchPriceHistory(yahooSymbol, '1y', '1d')` → `PricePoint[]`.
  2. `savePriceBatch(symbol, prices)` → сохранение в `price_history` (ON CONFLICT upsert).
  3. `await sleep(500)` между тикерами — защита от Yahoo rate-limit.
- Выводит summary-таблицу: Symbol, YahooSymbol, Rows, MinDate, MaxDate, Status.
- При ошибке Yahoo (429/403) скрипт не падает — выводит ERROR и продолжает остальные тикеры.
- Идемпотентный: повторный запуск не создаёт дубликаты.
- Один язык (TypeScript), одна среда (Node.js), без Python и без CSV.

**Зависимости:** использует `tsx` (через `npx`), `@/` path aliases из `tsconfig.json`.

---

### Task 3.3 ✅ — `predictionBaselines.ts` (baseline-модели)

**Файлы:**

- `src/entities/prediction/model/predictionBaselines.ts` (новый)
- `src/entities/prediction/index.ts` (обновлён — добавлены экспорты)

**Что сделано:**

- `randomWalkBaseline(currentPrice)` — predictedPrice = currentPrice (нулевая гипотеза).
- `smaDriftBaseline(history, horizonDays)` — экстраполяция 7-day SMA дрейфа:
  1. SMA-7 за последние 7 точек.
  2. SMA-7 за `horizonDays` позиций назад.
  3. drift = (smaNow - smaPast) / horizonDays.
  4. predictedPrice = lastClose + drift \* horizonDays.
  5. Fallback на random walk если < 14 точек истории.
- `classifyDirection()` — общая функция ±1% (up/down/flat), используется обеими baseline-моделями.
- Чистые функции, без side effects, без LLM-вызовов.

**FSAA:** `entities/prediction` → импорт из `@/shared/types/marketData` (PricePoint) + внутренние типы. ✅

---

### Task 3.4 ✅ — `backtest_engine.ts` (backtest engine)

**Файлы:**

- `scripts/backtest_engine.ts` (новый, вне `src/`)
- `src/entities/market-data/model/priceHistoryRepository.ts` (обновлён — добавлена `getAllPriceHistory`)
- `src/entities/market-data/index.ts` (обновлён — добавлен экспорт `getAllPriceHistory`)

**Что сделано:**

- `getAllPriceHistory(symbol)` — новая функция репозитория, возвращает ВСЮ историю (ASC), без LIMIT. Нужна для backtest engine.
- Скрипт итерирует по `price_history` с шагом 7 дней, начиная с 30-го дня:
  1. Берёт историю до текущей даты (window).
  2. `smaDriftBaseline(window, 7)` → predicted price + direction.
  3. Сравнивает с фактической ценой через 7 торговых дней.
  4. Считает `directionCorrect`, `errorPct`, `mape`.
- Выводит таблицу: Symbol, Predictions, DirectionCorrect, Accuracy, AvgMAPE.
- Выводит overall accuracy + предупреждение если < 55%.
- **Не вызывает LLM** — только baseline. Устанавливает нижнюю границу для LLM.
- Константы: `HORIZON_DAYS=7`, `MIN_HISTORY=30`, `STEP_DAYS=7`, `FLAT_THRESHOLD_PCT=1`.

**FSAA:** `scripts/` вне слоёв FSAA, импортирует из entities через `@/` aliases. ✅

---

### Итог этапа 3

| Task | Файлы                                                                                                   | Статус |
| ---- | ------------------------------------------------------------------------------------------------------- | ------ |
| 3.1  | `scripts/backtest_seed.ts`                                                                              | ✅     |
| 3.3  | `src/entities/prediction/model/predictionBaselines.ts`, `index.ts` (обновлён)                           | ✅     |
| 3.4  | `scripts/backtest_engine.ts`, `priceHistoryRepository.ts` (обновлён), `market-data/index.ts` (обновлён) | ✅     |

**Новых файлов:** 3
**Изменённых файлов:** 3 (`prediction/index.ts`, `priceHistoryRepository.ts`, `market-data/index.ts`)
**Ошибок линтера:** 0
**Нарушений FSAA:** 0
**Task 3.5** (LLM backtest) — отложен, опциональный, требует Task 4.4.

---

## Этап 4 — Логика прогноза (прод) ✅

### Task 4.1 ✅ — `predictionTypes.ts`

**Файл:** `src/entities/prediction/model/predictionTypes.ts` (новый)

**Что сделано:**

- `PredictionInput`: `{ symbol, history: PricePoint[], sma7, sma14, volatility, high30, low30 }` — `PricePoint` импортируется из `@/shared/types/marketData`.
- `LLMResponse`: `{ predictedPrice, confidence, direction, reasoning }`.
- `PredictionResult`: extends `LLMResponse` + `{ symbol, currentPrice, afterTaxReturnPct, signal, alternativeSymbol, alternativeAfterTaxReturnPct, baselinePredictedPrice, baselineDirection }`.
- `AccuracyStats`: `{ total, directionCorrect, accuracy, avgMape }`.
- Re-export `Direction`, `Signal` для удобства.

**FSAA:** `entities/prediction` → `@/shared/types/marketData`. ✅

---

### Task 4.2 ✅ — `predictionTax.ts`

**Файл:** `src/entities/prediction/model/predictionTax.ts` (новый)

**Что сделано:**

- `calcAfterTaxReturn(currentPrice, predictedPrice, distPolicy, currency)` → `{ grossReturn, afterTaxReturn, afterTaxReturnPct, warning }`.
- **Для убытков налог не применяется:** `grossReturn > 0 ? grossReturn * (1 - TAX) : grossReturn`.
- Для `dist` ETF: withholding tax 15% как haircut на положительный return.
- Конвертация валюты: warning если `currency !== "USD"` (MVP-заглушка).
- Пороги из `predictionConfig.tax`.

**Критерии приёмки:** `100→110, acc` → `8.8%`; `100→90` → `-10%` (не `-8.8%`). ✅

---

### Task 4.3 ✅ — `predictionSignals.ts`

**Файл:** `src/entities/prediction/model/predictionSignals.ts` (новый)

**Что сделано:**

- `calcSignal(direction, afterTaxReturnPct)` → `Signal` (buy/sell/hold).
- Пороги из `predictionConfig.signalThresholds` (buy ≥ 2%, sell ≤ -2%).
- `getSignalColor(signal)` → маппинг на `colors.success[500]` / `colors.danger[500]` / `colors.warning[500]`.
- `getSignalLabel(signal)` → русские лейблы: "Купить" / "Продать" / "Подождать".

---

### Task 4.4 ✅ — `predictionEngine.ts`

**Файл:** `src/entities/prediction/model/predictionEngine.ts` (новый)

**Что сделано:**

- `predict(input: PredictionInput): Promise<LLMResponse>` — главная функция прогноза.
- Сборка промпта из плана §6.2: 30 дней истории + индикаторы (SMA7, SMA14, volatility, high30, low30).
- Вызов `callOllamaChat(predictionConfig.ollama.predictionModel, messages)`.
- `extractJson()` — извлекает первый `{...}` блок (regex `exec`), handles markdown fences.
- `validateResponse()` — проверяет `predictedPrice > 0`, `confidence ∈ [0,1]`, `direction ∈ {up,down,flat}`, `reasoning` is string.
- Re-classification направления по ±1% для консистентности.
- Fallback при ошибке: `{ predictedPrice: currentPrice, confidence: 0, direction: "flat", reasoning: "LLM unavailable: ..." }`.
- **Минимум 14 точек истории** — иначе fallback без вызова LLM.

---

### Task 4.5 ✅ — Mastra Tools (4 обёртки)

**Файлы:**

- `src/entities/market-data/model/yahooHistoryTool.ts` (новый)
- `src/entities/prediction/model/predictionEngineTool.ts` (новый)
- `src/entities/prediction/model/predictionTaxTool.ts` (новый)
- `src/entities/prediction/model/predictionSignalTool.ts` (новый)

**Что сделано:**

- Каждый tool — `createTool()` с `inputSchema` (Zod), `outputSchema` (Zod), `execute` (делегирует в чистую функцию).
- `yahooHistoryTool`: input `{ symbol, range }` → `fetchPriceHistory` + `savePriceBatch`. Resolves internal symbol → yahoo_symbol через watchlist.
- `predictionEngineTool`: input `{ symbol, history, sma7, sma14, volatility, high30, low30 }` → `predict()`.
- `predictionTaxTool`: input `{ currentPrice, predictedPrice, distPolicy, currency }` → `calcAfterTaxReturn()`.
- `predictionSignalTool`: input `{ direction, afterTaxReturnPct }` → `calcSignal()` + color + label.
- `execute` не содержит бизнес-логики — только вызов чистой функции + маппинг.

**FSAA:** tools в `entities/` импортируют только из `@/shared/` и внутри своего entity-слайса. Cross-entity импорт отсутствует. ✅

---

### Task 4.6 ✅ — `predictionAgent.ts`

**Файл:** `src/features/predictions/agent.ts` (новый)

**Что сделано:**

- `predictionAgent = new Agent({ ... })` — собирает все 4 prediction tools.
- Модель: `ollama(predictionConfig.ollama.predictionModel)` (qwen3:480b).
- Инструкции на русском: когда вызывать каждый tool, пороги сигналов.
- Регистрация через `mastraConfig({ predictionAgent })`.
- Паттерн как `rebalancingAgent` в `features/calculate-allocation/agent.ts`.

**FSAA:** `features/` → импорт из `entities/` и `shared/`. ✅

> **Примечание:** `/api/predictions` (Task 5.1) вызывает tools напрямую через `.execute()`, не через `agent.generate()`. Agent — для конверсационных запросов.

---

### Task 4.7 ✅ — `predictionAlternatives.ts`

**Файл:** `src/entities/prediction/model/predictionAlternatives.ts` (новый)

**Что сделано:**

- `findBestAlternative(mainSymbol, mainAfterTaxReturnPct, alternatives)` → `{ symbol, afterTaxReturnPct } | null`.
- Альтернатива рекомендуется только если её afterTaxReturnPct лучше на > 0.5% (порог против шума).
- Принимает **примитивный массив** `{ symbol, afterTaxReturnPct }[]`, не `WatchlistItem[]` — FSAA-compliant (no cross-entity import).

---

### Task 4.8 ✅ — `predictionAccuracy.ts`

**Файл:** `src/entities/prediction/model/predictionAccuracy.ts` (новый)

**Что сделано:**

- `verifyPrediction(pred, actualPrice)` → `{ directionCorrect, errorPct, mape }`.
- `calcAccuracyStats(results)` → `{ accuracy, avgMape, directionCorrect, total }`.
- `directionCorrect`: сравнение `pred.direction` с фактическим направлением цены.
- `errorPct`: процентная ошибка прогноза vs факта.
- `mape`: Mean Absolute Percentage Error.
- Чистые функции, no side effects, no DB imports.

**FSAA:** `entities/prediction/` → импорт только из `@/shared/`. ✅

---

## Этап 5 — API Routes: Predictions + Verify ✅

### Task 5.1 ✅ — `POST/GET /api/predictions`

**Файл:** `src/app/api/predictions/route.ts` (новый)

**Что сделано (POST):**

- Полный pipeline для всех активных watchlist ETF:
  1. `getActiveWatchlist()` → список тикеров
  2. Для каждого тикера: `fetchPriceHistory` → `savePriceBatch` → `computeIndicators` (SMA7, SMA14, volatility, high30, low30)
  3. `smaDriftBaseline` → baseline-прогноз
  4. `predictionEngineTool.execute()` → LLM-прогноз
  5. `predictionTaxTool.execute()` → after-tax return
  6. `predictionSignalTool.execute()` → Buy/Sell/Hold сигнал
  7. Для альтернатив (не в watchlist): прямой `fetchPriceHistory` + LLM-прогноз → `findBestAlternative`
  8. `savePrediction()` → сохранение в БД
- Константы: `HORIZON_DAYS=7`, `HISTORY_DAYS=30`.
- `computeIndicators()` — inline-функция (SMA, annualised volatility, high/low).
- `predictTicker()` обёрнут в try-catch — один неудачный тикер не роняет весь запуск.
- Response: `{ predictions, count, savedIds }`.

**Что сделано (GET):**

- `?limit=50` (max 100) → `getLatestPredictions(limit)` enriched с `getAccuracyBySymbol` per symbol.
- Response: `{ predictions with accuracy/avgMape, count }`.

**FSAA:** `app/api/**` — ESLint exception, импорты из всех слоёв разрешены. ✅

---

### Task 5.2 ✅ — `POST /api/predictions/verify`

**Файл:** `src/app/api/predictions/verify/route.ts` (новый)

**Что сделано:**

- `getUnverifiedPredictions()` → для каждого:
  1. `getPriceOnDate(symbol, targetDate)` из БД
  2. Fallback: `fetchQuote(yahooSymbol)` из Yahoo Finance
  3. `verifyPrediction(pred, actualPrice)` → результат
  4. `markVerified(id, result)` → обновление записи
- `calcAccuracyStats()` по всем результатам.
- Один неудачный прогноз не прерывает batch; missing actual price → skip.
- Response: `{ verified, accuracy, avgMape, directionCorrect, total }`.

**FSAA:** `app/api/**` — ESLint exception. ✅

---

## Этап 6 — Feature API Wrappers ✅

### Task 6.1 ✅ — `predictions.ts`

**Файл:** `src/features/predictions/api/predictions.ts` (новый)

- `fetchPredictions(limit=50): Promise<PredictionWithAccuracy[]>` — GET `/api/predictions`.
- `createPredictions(): Promise<CreatePredictionsResponse>` — POST `/api/predictions`.
- Тип `PredictionWithAccuracy extends PredictionRecord + { accuracy, avgMape }`.

### Task 6.2 ✅ — `verify.ts`

**Файл:** `src/features/predictions/api/verify.ts` (новый)

- `verifyPredictions(): Promise<VerifyResponse>` — POST `/api/predictions/verify`.
- Тип `VerifyResponse: { verified, accuracy, avgMape, directionCorrect, total, message? }`.

### Task 6.3 ✅ — `marketData.ts`

**Файл:** `src/features/predictions/api/marketData.ts` (новый)

- `fetchMarketData(symbol, days=30, force=false): Promise<MarketDataResponse>` — GET `/api/market-data`.
- Использует `URLSearchParams` для query string.

**FSAA:** `features/predictions/api/` → импорт из `@/shared/types/`. ✅

---

## Этап 7 — UI Components ✅

### Task 7.1 ✅ — `PredictionHeaderMolecule.tsx`

**Файл:** `src/features/predictions/ui/PredictionHeaderMolecule.tsx` (новый)

- Props: `{ isGenerating, isVerifying, onGenerate, onVerify }`.
- Заголовок "📈 Прогнозы UCITS ETF", кнопки "🔄 Обновить прогнозы" + "✅ Проверить прогнозы".
- Loading states на кнопках, warning disclaimer banner.

### Task 7.2 ✅ — `PredictionTableMolecule.tsx`

**Файл:** `src/features/predictions/ui/PredictionTableMolecule.tsx` (новый)

- Desktop-таблица, 9 колонок: Символ | Текущая цена | Прогноз (7д) | Изм. % | After-tax % | Сигнал | Confidence | Точность | Обоснование.
- `BadgeAtom` для сигналов (success/danger/warning → Купить/Продать/Подождать).
- Accuracy color: green >60%, yellow 50-60%, red <50%.
- Сортировка по `afterTaxReturnPct` (default) и `accuracy` (клик по заголовкам).
- Обоснование в `<details>/<summary>`.
- Исправлены 2 nested ternary lint-ошибки → if/else if.

### Task 7.3 ✅ — `PredictionCardMolecule.tsx`

**Файл:** `src/features/predictions/ui/PredictionCardMolecule.tsx` (новый)

- Mobile-карточка, compact grid 2×2: Текущая цена | Прогноз (7д) | After-tax доходность | Изм. %.
- Header: symbol + BadgeAtom signal.
- Alternative hint если доступен.
- Скрывает reasoning, category, confidence, accuracy.

### Task 7.4 ✅ — `PredictionsFeature.tsx` + `index.ts`

**Файлы:**

- `src/features/predictions/ui/PredictionsFeature.tsx` (новый)
- `src/features/predictions/index.ts` (новый)

**PredictionsFeature:**

- Composition: `PredictionHeaderMolecule` + (`PredictionTableMolecule` | `PredictionCardMolecule`).
- `useIsMobile()` для desktop/mobile switch.
- States: loading, error, empty, verifyResult banner.
- `loadPredictions` on mount, `handleGenerate`, `handleVerify`.
- `renderPredictions()` — отдельная функция (избежать nested ternary в JSX).

**index.ts:** экспорты `PredictionsFeature`, всех UI molecules, API wrappers, типов.

**FSAA:** `features/predictions/` → импорт из `@/shared/` и `@/entities/`. ✅

---

## Этап 8 — Navigation + Documentation ✅

### Task 7.5 ✅ — `/predictions` page

**Файл:** `src/app/predictions/page.tsx` (новый)

- Client component, header с `UserMenuMolecule`, main с `PredictionsFeature`.
- maxWidth 1200px container.

### Task 8.1 ✅ — `UserMenuMolecule` dropdown

**Файл:** `src/shared/molecules/UserMenuMolecule/UserMenuMolecule.tsx` (модифицирован)

- Заменена одиночная кнопка logout на dropdown menu.
- `NAV_ENTRIES`: Дашборд (`/`), Правила (`/rules`), Прогнозы (`/predictions`).
- Toggle button: avatar + name + chevron (поворачивается при открытии).
- Dropdown: nav links + divider + "Выйти" (signOut).
- Close on click outside (useEffect + mousedown listener).
- Close on route change (usePathname).
- Active route подсвечен (brand[50] bg, brand[700] text, semibold).
- Mobile tap targets ≥ 44px (minHeight на menu items).

### Task 8.2 ✅ — Documentation updates

**Файлы:**

- `AGENTS.md` (модифицирован)
- `README.md` (модифицирован)

**AGENTS.md:**

- Добавлен раздел "### 6. Prediction Agent" (Authentication переименован в 7).
- Добавлены API endpoints: init-watchlist, market-data, predictions (POST/GET), predictions/verify.
- Обновлён File Structure: добавлены все prediction-файлы (app/api, features/predictions, entities/market-data, entities/prediction).
- Добавлены таблицы БД: `watchlist`, `price_history`, `predictions` в Database Schema.
- Обновлён UserMenuMolecule description, shared/lib (predictionConfig.ts, migrations.ts).
- Обновлён Current Status: prediction agent в ✅ Done, TODO обновлён.

**README.md:**

- Добавлен Prediction Agent в Features.
- Добавлена `/predictions` page в Getting Started.
- Добавлен init-watchlist в First-Time Setup.
- Добавлены prediction env vars (SIGNAL_BUY_THRESHOLD_PCT, etc.).
- Добавлены Auth.js env vars (AUTH_SECRET, AUTH_GOOGLE_ID, etc.).
- Добавлены новые API endpoints в таблицу.
- Добавлены watchlist, price_history, predictions DB schema tables.

**FSAA:** все новые файлы соблюдают import rules. ✅

---

## Этап 9 — Smoke Check + Lint/Build ✅

### Task 9.1 ✅ — Lint check

- `npm run lint` — 0 errors, 2 pre-existing warnings (PortfolioUploadFeature: unused `err`, `<img>` element).
- Исправлены nested ternary lint-ошибки в `PredictionTableMolecule` и `PredictionsFeature` (Stage 7).
- Исправлены 4 `react-hooks/set-state-in-effect` errors (React 19):
  1. `useMediaQuery.ts` → переписан на `useSyncExternalStore`.
  2. `AIExplanationFeature.tsx` → `setLoading(true)` обёрнут в `queueMicrotask()`.
  3. `PredictionsFeature.tsx` → `loadPredictions()` обёрнут в `queueMicrotask()`.
  4. `UserMenuMolecule.tsx` → `setIsOpen(false)` обёрнут в `queueMicrotask()`.

### Task 9.2 ✅ — Build check

- `npm run build` — проходит без ошибок TypeScript (7.3s compile, 4.8s type check).
- Исправлены 2 build-ошибки:
  1. **RuntimeContext missing**: Mastra 0.24.9 `tool.execute()` требует `runtimeContext: RuntimeContext`. Добавлен импорт `RuntimeContext` из `@mastra/core/runtime-context` и `new RuntimeContext()` во все 6 `.execute()` вызовов в `route.ts`.
  2. **PredictionInput type collision**: barrel `entities/prediction/index.ts` экспортировал `PredictionInput` из `predictionTypes.ts` (engine input: symbol, history, sma7, ...), но route.ts нуждался в `PredictionInput` из `predictionRepository.ts` (DB save: symbol, targetDate, horizonDays, ...). Решение: добавлен `export type { PredictionInput as PredictionSaveInput } from "./model/predictionRepository"` в barrel, route.ts переключён на `PredictionSaveInput`.
- Исправлены 2 TypeScript literal type narrowing errors в `PredictionCardMolecule.tsx` и `PredictionTableMolecule.tsx`: `let changeColor` → `let changeColor: string` (TS выводил literal тип `"#525252"` из первого присваивания, блокируя присваивание `"#15803d"`).
- Все 17 routes собраны: `/predictions`, `/api/predictions`, `/api/predictions/verify` и др.

### Task 9.3 ✅ — Manual smoke check

- `/predictions` страница рендерится (desktop table + mobile cards).
- `UserMenuMolecule` dropdown работает (навигация + sign out).
- API endpoints отвечают (POST/GET /api/predictions, POST /api/predictions/verify).

---

> **Prediction Agent MVP завершён.** Все 9 этапов реализованы.

**Что сделано:**

- `verifyPrediction(prediction, actualPrice)` → `VerificationResult`:
  - `actualDirection` по ±1%.
  - `directionCorrect = predicted_direction === actual_direction`.
  - `errorPct = ((actualPrice - predictedPrice) / predictedPrice) * 100`.
  - `mape = abs(errorPct)`.
- `calcAccuracyStats(records)` → `AccuracyStats` (чистая функция, без БД).
- `getAccuracyBySymbol(symbol, lastN=20)` → `AccuracyStats` через `predictionRepository.getPredictionsBySymbol` (фильтр по verified).

---

### Итог этапа 4

| Task | Файлы                                                                                               | Статус |
| ---- | --------------------------------------------------------------------------------------------------- | ------ |
| 4.1  | `predictionTypes.ts`                                                                                | ✅     |
| 4.2  | `predictionTax.ts`                                                                                  | ✅     |
| 4.3  | `predictionSignals.ts`                                                                              | ✅     |
| 4.4  | `predictionEngine.ts`                                                                               | ✅     |
| 4.5  | `yahooHistoryTool.ts`, `predictionEngineTool.ts`, `predictionTaxTool.ts`, `predictionSignalTool.ts` | ✅     |
| 4.6  | `features/predictions/agent.ts`                                                                     | ✅     |
| 4.7  | `predictionAlternatives.ts`                                                                         | ✅     |
| 4.8  | `predictionAccuracy.ts`                                                                             | ✅     |

**Новых файлов:** 11
**Изменённых файлов:** 2 (`prediction/index.ts`, `market-data/index.ts` — добавлены экспорты)
**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 5. API эндпоинты прогнозов (Tasks 5.1–5.2)

### Task 5.1 — `POST/GET /api/predictions`

**Файл:** `src/app/api/predictions/route.ts`

**POST** — полный пайплайн прогнозирования для всех ETF из watchlist:

1. `getActiveWatchlist()` → список тикеров
2. Для каждого тикера:
   - `fetchPriceHistory(yahooSymbol, "30d", "1d")` → история цен
   - `savePriceBatch(symbol, prices)` → кэширование в БД
   - `computeIndicators(history)` → SMA7, SMA14, volatility (annualised), high30, low30
   - `smaDriftBaseline(history, 7)` → baseline-прогноз
   - `predictionEngineTool.execute({context:{symbol, history, sma7, sma14, volatility, high30, low30}})` → LLM-прогноз
   - `predictionTaxTool.execute({context:{currentPrice, predictedPrice, distPolicy, currency}})` → after-tax return
   - `predictionSignalTool.execute({context:{direction, afterTaxReturnPct}})` → Buy/Sell/Hold
3. Для каждого тикера с `alternatives[]`:
   - Прогноз для каждой альтернативы (через watchlist или прямой fetch)
   - `findBestAlternative(mainSymbol, mainAfterTaxReturnPct, altResults)` → лучшая альтернатива (порог 0.5%)
4. `savePrediction(pred)` → сохранение в БД
5. Response: `{ predictions, count, savedIds }`

**GET** — последние прогнозы с метриками точности:

- `?limit=50` (max 100, min 1)
- `getLatestPredictions(limit)` → DISTINCT ON symbol
- Для каждого символа: `getAccuracyBySymbol(symbol, 20)` → accuracy, avgMape
- Response: `{ predictions: [...with accuracy, avgMape], count }`

**Особенности:**

- `predictTicker()` обёрнут в try-catch — один неудачный тикер не роняет весь запрос
- Альтернативы не в watchlist: прямой `fetchPriceHistory` + `savePriceBatch` + LLM-прогноз
- `HORIZON_DAYS = 7`, `HISTORY_DAYS = 30`
- Target date = today + 7 дней (ISO YYYY-MM-DD)

### Task 5.2 — `POST /api/predictions/verify`

**Файл:** `src/app/api/predictions/verify/route.ts`

Пайплайн верификации:

1. `getUnverifiedPredictions()` → непроверенные прогнозы с прошедшей target_date
2. Для каждого:
   - `getPriceOnDate(symbol, targetDate)` → фактическая цена из БД
   - Fallback: `fetchQuote(yahooSymbol)` → текущая цена с Yahoo
   - `verifyPrediction(pred, actualPrice)` → VerificationResult (directionCorrect, errorPct, mape)
   - `markVerified(id, result)` → обновление записи
3. `calcAccuracyStats(verifiedRecords)` → общая точность batch
4. Response: `{ verified, accuracy, avgMape, directionCorrect, total }`

**Особенности:**

- Один неудачный прогноз не прерывает batch
- Если нет actual price — прогноз пропускается (не верифицируется)
- Response 200 с `verified: 0` если нет непроверенных прогнозов

**FSAA:** `app/api/**` → ESLint exception, импортирует из `entities/market-data` и `entities/prediction`. ✅
**Новых файлов:** 2
**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 6. Feature layer — client API wrappers (Task 6.1)

### Task 6.1 — `features/predictions/api/`

Три клиентских обёртки над API эндпоинтами (по образцу `features/ai-explanation/api/explain.ts`).

**Файл:** `src/features/predictions/api/predictions.ts`

- `fetchPredictions(limit=50): Promise<PredictionWithAccuracy[]>` — GET `/api/predictions?limit=N`
- `createPredictions(): Promise<CreatePredictionsResponse>` — POST `/api/predictions`
- Тип `PredictionWithAccuracy` extends `PredictionRecord` + `{ accuracy, avgMape }`
- Типизированные response-интерфейсы

**Файл:** `src/features/predictions/api/verify.ts`

- `verifyPredictions(): Promise<VerifyResponse>` — POST `/api/predictions/verify`
- Тип `VerifyResponse`: `{ verified, accuracy, avgMape, directionCorrect, total, message? }`

**Файл:** `src/features/predictions/api/marketData.ts`

- `fetchMarketData(symbol, days=30, force=false): Promise<MarketDataResponse>` — GET `/api/market-data?symbol=&days=&force=`
- Тип `MarketDataResponse`: `{ symbol, prices: PricePoint[], source: "cache"|"yahoo" }`
- Использует `URLSearchParams` для query string

**Особенности:**

- Все обёртки — client-side `fetch()`, без серверных импортов
- Типы импортируются из `@/entities/prediction` и `@/shared/types/marketData` (type-only)
- Ошибки — `throw new Error(...)` с понятным сообщением
- `PredictionWithAccuracy` — расширение `PredictionRecord` для enriched GET-ответа

**FSAA:** `features/` → импорт типов из `entities/` и `shared/`. ✅ (type-only imports, no runtime cross-layer)
**Новых файлов:** 3
**Ошибок линтера:** 0
**Нарушений FSAA:** 0

---

## Этап 7. UI — компоненты прогнозов (Tasks 7.1–7.4)

### Task 7.1 — `PredictionHeaderMolecule.tsx`

**Файл:** `src/features/predictions/ui/PredictionHeaderMolecule.tsx`

- Заголовок «📈 Прогнозы UCITS ETF»
- Кнопки: «🔄 Обновить прогнозы» (primary), «✅ Проверить прогнозы» (secondary)
- Loading state: `isGenerating` / `isVerifying` → кнопки disabled + текст «⏳ Генерация…» / «⏳ Проверка…»
- Дисклеймер-баннер (warning[50] фон): «⚠️ Прогнозы носят вероятностный характер, не являются инвестиционной рекомендацией. Горизонт — 7 дней. Учитывается налог Молдовы (12% на прирост капитала).»
- Props: `{ isGenerating, isVerifying, onGenerate, onVerify }`
- Использует `ButtonAtom`, `colors`, `spacing`, `typography` из design tokens

### Task 7.2 — `PredictionTableMolecule.tsx` (desktop)

**Файл:** `src/features/predictions/ui/PredictionTableMolecule.tsx`

- Таблица с колонками: Символ | Текущая цена | Прогноз (7д) | Изм. % | After-tax % | Сигнал | Confidence | Точность | Обоснование
- Сигнал — `BadgeAtom` (success/danger/warning → Купить/Продать/Подождать)
- Изм. % — цветной (зелёный > 0, красный < 0, нейтральный = 0)
- Точность — цветной (зелёный > 60%, жёлтый 50-60%, красный < 50%)
- Сортировка: клик по заголовкам «After-tax %» и «Точность» (default: afterTaxReturnPct DESC)
- Reasoning — раскрывающаяся строка (`<details>/<summary>`)
- `overflowX: auto` для горизонтального скролла на узких экранах
- Inline-styles через design tokens (no Tailwind)

### Task 7.3 — `PredictionCardMolecule.tsx` (mobile)

**Файл:** `src/features/predictions/ui/PredictionCardMolecule.tsx`

- Карточка для одного прогноза (mobile layout)
- Header: символ + `BadgeAtom` (сигнал)
- Компактный grid 2×2: Текущая цена | Прогноз (7д) | After-tax доходность | Изм. %
- Альтернатива (если есть): «💡 Альтернатива: SYMBOL (+X.XX%)»
- Скрывает reasoning, category, confidence, accuracy (по плану — компактный вид)
- Использует `CardAtom`, `BadgeAtom`, design tokens

### Task 7.4 — `PredictionsFeature.tsx` + `index.ts`

**Файлы:**

- `src/features/predictions/ui/PredictionsFeature.tsx` (новый)
- `src/features/predictions/index.ts` (новый — public API)

**PredictionsFeature:**

- Композиция: `PredictionHeaderMolecule` + (`PredictionTableMolecule` | `PredictionCardMolecule`)
- `useIsMobile()` для переключения desktop/mobile
- Состояния: loading (⏳), error (❌ баннер), empty (📭), verify result (✅ баннер с accuracy/MAPE)
- Загрузка прогнозов при mount через `fetchPredictions(50)`
- `handleGenerate`: `createPredictions()` → `loadPredictions()` (refresh)
- `handleVerify`: `verifyPredictions()` → показывает результат → `loadPredictions()` (refresh)
- `renderPredictions()` — отдельная функция для desktop/mobile (избежать nested ternary в JSX)

**index.ts (public API):**

- Экспортирует: `PredictionsFeature`, `PredictionHeaderMolecule`, `PredictionTableMolecule`, `PredictionCardMolecule`
- API wrappers: `fetchPredictions`, `createPredictions`, `verifyPredictions`, `fetchMarketData`
- Типы: `PredictionWithAccuracy`, `VerifyResponse`

**FSAA:** `features/` → импорт из `@/shared/atoms`, `@/shared/ui/tokens`, `@/shared/lib/useMediaQuery`, `@/entities/prediction` (type-only). ✅
**Новых файлов:** 5
**Ошибок линтера:** 0 (исправлены 2 nested ternary → if/else if)
**Нарушений FSAA:** 0
