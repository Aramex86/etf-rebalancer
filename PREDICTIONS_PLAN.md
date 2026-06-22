# План фичи: Prediction Agent / Скринер выгодных UCITS-сделок

> Статус: план реализации (код не написан).  
> Цель: искать выгодные точки входа/выхода в UCITS ETF с учётом прогноза цены и налоговой нагрузки для резидента Молдовы (Interactive Brokers Ireland).  
> Важно: текущий портфель и логика ребалансировки из `AGENTS.md` **не трогаются**. Новая фича — отдельный инструмент.

---

## 1. Контекст и цель

Пользователь — резидент Молдовы, брокер Interactive Brokers Ireland. Двойное налогообложение делает инвестиции в американские активы менее выгодными. Предпочтение отдаётся UCITS ETF (Ирландия / Люксембург).

Фича добавляет агента, который:

1. Мониторит отдельный watchlist из UCITS ETF.
2. Прогнозирует цену каждого тикера на 1 неделю вперёд.
3. Сравнивает прогноз с фактом и считает accuracy.
4. Учитывает налог на прирост капитала (Молдова, 12%).
5. Предлагает альтернативные UCITS ETF с похожим exposure.
6. Выдаёт сигналы: **Купить / Продать / Подождать**.

---

## 2. Границы фичи (Scope)

| Параметр          | Решение                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Универс тикеров   | Только UCITS ETF                                                                            |
| Горизонт прогноза | 7 дней                                                                                      |
| Источник цен      | Yahoo Finance                                                                               |
| Модель прогноза   | LLM через Ollama Cloud (`qwen3-coder:480b` или аналог)                                      |
| Альтернативы      | Агент сам предлагает варианты на основе хардкод-маппинга похожих UCITS ETF                  |
| Продажи           | Сигнал `Sell` формируется по рекомендациям агента, независимо от текущего портфеля          |
| Альтернативы      | Прогнозируются каждый раз вместе с основным тикером                                         |
| Налоги            | Только налог на прирост капитала (12%), дивиденды не учитываем                              |
| UI                | Новая страница `/predictions`                                                               |
| Обновление        | Сначала по кнопке, позже — cron                                                             |
| Обучение          | Сохраняем прогнозы, сравниваем с фактом, считаем `direction_correct`, `error_pct`, accuracy |

---

## 3. Архитектура (FSAA)

Проект следует Feature-Sliced Atomic Architecture. Новая фича вписывается так:

```
src/
├── app/
│   ├── predictions/
│   │   └── page.tsx              # Страница скринера
│   └── api/
│       ├── market-data/
│       │   └── route.ts          # GET история цен из Yahoo Finance
│       ├── predictions/
│       │   └── route.ts          # POST создать прогнозы, GET список
│       ├── predictions/verify/
│       │   └── route.ts          # POST проверить старые прогнозы
│       └── init-watchlist/
│           └── route.ts          # POST seed watchlist (idempotent)
│
├── entities/
│   ├── market-data/
│   │   ├── index.ts              # Публичный API
│   │   └── model/
│   │       ├── yahooFinanceClient.ts   # Fetch истории цен
│   │       ├── marketDataTypes.ts      # Типы
│   │       └── watchlistSeed.ts        # Начальный список UCITS ETF
│   │
│   └── prediction/
│       ├── index.ts              # Публичный API
│       └── model/
│           ├── predictionEngine.ts     # Логика прогноза + промпт
│           ├── predictionAccuracy.ts   # Проверка прогнозов, accuracy
│           ├── predictionSignals.ts    # Buy / Sell / Hold
│           ├── predictionTax.ts        # After-tax return (12%)
│           ├── predictionAlternatives.ts # Маппинг UCITS альтернатив
│           └── predictionTypes.ts      # Типы
│
├── features/
│   └── predictions/
│       ├── index.ts              # Публичный API
│       ├── api/
│       │   ├── marketData.ts     # Обёртка над /api/market-data
│       │   ├── predictions.ts    # Обёртка над /api/predictions
│       │   └── verify.ts         # Обёртка над /api/predictions/verify
│       └── ui/
│           ├── PredictionsFeature.tsx      # Основной компонент страницы
│           ├── PredictionTableMolecule.tsx   # Таблица прогнозов
│           ├── PredictionCardMolecule.tsx    # Карточка для мобильного вида
│           └── PredictionHeaderMolecule.tsx  # Заголовок + кнопки
│
└── shared/
    └── lib/
        └── ollama.ts             # Расширяем для prediction prompt
```

### Правила импортов

> **FSAA-строго:** entities не могут импортировать друг из друга. Разделяемые типы
> (например `PricePoint`) живут в `shared/types/`. Composition (сборка данных из
> нескольких entities) происходит в `features/` или `app/api/`.

- `entities/market-data` → может импортировать только `shared/`
- `entities/prediction` → может импортировать только `shared/` (НЕ `entities/market-data`)
- `features/predictions` → может импортировать `entities/prediction`, `entities/market-data`, `shared/`
- `app/predictions/page.tsx` → может импортировать `features/`, `shared/` (через ESLint exception для page.tsx)
- `app/api/**` → exempt, может импортировать любые слои (composition point)

---

## 4. База данных

### 4.1. `watchlist`

Список UCITS ETF, которые сканирует агент.

```sql
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  alternatives TEXT[] DEFAULT '{}',
  tax_profile TEXT NOT NULL DEFAULT 'ucits_ie',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2. `price_history`

История цен close (минимальный набор для прогноза).

```sql
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  close DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, date)
);

CREATE INDEX idx_price_history_symbol_date ON price_history(symbol, date DESC);
```

### 4.3. `predictions`

Сохранённые прогнозы и их проверка.

```sql
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  horizon_days INTEGER NOT NULL DEFAULT 7,
  current_price DECIMAL(12,4) NOT NULL,
  predicted_price DECIMAL(12,4) NOT NULL,
  predicted_direction TEXT NOT NULL CHECK (predicted_direction IN ('up', 'down', 'flat')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  actual_price DECIMAL(12,4),
  actual_direction TEXT CHECK (actual_direction IN ('up', 'down', 'flat')),
  direction_correct BOOLEAN,
  error_pct DECIMAL(8,4),
  verified_at TIMESTAMP,
  after_tax_return_pct DECIMAL(8,4),
  signal TEXT CHECK (signal IN ('buy', 'sell', 'hold')),
  alternative_symbol TEXT,
  alternative_after_tax_return_pct DECIMAL(8,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictions_symbol_predicted_at ON predictions(symbol, predicted_at DESC);
CREATE INDEX idx_predictions_verified_at ON predictions(verified_at) WHERE verified_at IS NULL;
```

---

## 5. API Endpoints

### 5.1. `GET /api/market-data?symbol=SWRD&days=30`

Возвращает историю цен `close` за указанное количество дней из Yahoo Finance. Сохраняет данные в `price_history`.

**Response:**

```json
{
  "symbol": "SWRD",
  "days": 30,
  "prices": [
    { "date": "2026-05-20", "close": 52.1 },
    { "date": "2026-05-21", "close": 52.35 }
  ]
}
```

### 5.2. `POST /api/predictions`

Создаёт прогнозы для всех активных тикеров из `watchlist`.

**Flow:**

1. Загружает историю цен за 30 дней для каждого тикера.
2. Отправляет в Ollama структурированный промпт.
3. Парсит JSON-ответ.
4. Считает after-tax return и сигнал.
5. Подбирает альтернативу.
6. Сохраняет в `predictions`.

**Response:**

```json
{
  "predictions": [
    {
      "symbol": "SWRD",
      "currentPrice": 52.35,
      "predictedPrice": 54.1,
      "predictedDirection": "up",
      "confidence": 0.72,
      "afterTaxReturnPct": 2.95,
      "signal": "buy",
      "alternativeSymbol": "VWCE",
      "alternativeAfterTaxReturnPct": 3.1,
      "reasoning": "Price broke above 20-day moving average with low volatility."
    }
  ]
}
```

### 5.3. `GET /api/predictions?limit=50`

Возвращает последние прогнозы.

### 5.4. `POST /api/predictions/verify`

Проверяет непроверенные прогнозы, у которых `predicted_at + horizon_days <= today`.

**Flow:**

1. Находит прогнозы, для которых наступил срок верификации.
2. Загружает фактическую цену из `price_history` или Yahoo Finance.
3. Считает `actual_direction`, `direction_correct`, `error_pct`.
4. Обновляет запись.

**Response:**

```json
{
  "verified": 7,
  "accuracy": 0.57
}
```

### 5.5. `POST /api/init-watchlist`

Idempotent seed начального watchlist.

---

## 6. Логика прогноза

### 6.1. История цен

- Загружаем последние 30 дней close.
- Формат для LLM: массив `{ date, close }`.
- Дополнительно считаем простые индикаторы на стороне приложения:
  - 7-day SMA
  - 14-day SMA
  - Волатильность (std dev за 14 дней)
  - Максимум/минимум за 30 дней

### 6.2. Промпт для Ollama

```text
You are a financial forecasting assistant. Analyze the following 30-day price history for UCITS ETF {symbol}.

Price history:
{json_array}

Additional context:
- 7-day SMA: {sma7}
- 14-day SMA: {sma14}
- 30-day volatility: {volatility}
- 30-day high: {high}
- 30-day low: {low}

Predict the closing price exactly 7 calendar days from now.
Return ONLY a JSON object with this exact structure:
{
  "predictedPrice": number,
  "confidence": number between 0 and 1,
  "direction": "up" | "down" | "flat",
  "reasoning": "short explanation in English"
}

Rules:
- "up" means predicted price is at least 1% higher than current price.
- "down" means predicted price is at least 1% lower than current price.
- "flat" means change is within ±1%.
- Confidence should reflect data quality and trend clarity.
```

### 6.3. Парсинг ответа

- Извлекаем JSON из ответа LLM.
- Валидируем типы.
- При ошибке — логируем, возвращаем `hold` с `confidence = 0`.

---

## 7. Налоговый расчёт

Учитываем только налог на прирост капитала в Молдове (12%).

```typescript
const grossReturn = predictedPrice - currentPrice;
const afterTaxReturn = grossReturn * (1 - 0.12);
const afterTaxReturnPct = (afterTaxReturn / currentPrice) * 100;
```

Для short-сигналов (sell) формула та же — налог на прирост применяется к разнице.

---

## 8. Сигналы Buy / Sell / Hold

### 8.1. Пороги (MVP)

| Сигнал   | Условие                                                       |
| -------- | ------------------------------------------------------------- |
| **Buy**  | `predicted_direction === 'up'` И `afterTaxReturnPct >= 2%`    |
| **Sell** | `predicted_direction === 'down'` И `afterTaxReturnPct <= -2%` |
| **Hold** | всё остальное                                                 |

Почему 2%:

- Комиссии и спред IB Ireland съедают мелкие движения.
- После налога 12% от +2% остаётся ~1.76% — минимально осмысленный доход.
- LLM ошибается на 1–2%, порог фильтрует шум.
- Горизонт 7 дней: +2% за неделю — вполне реалистично для ETF.

Пороги вынесены в env:

```bash
SIGNAL_BUY_THRESHOLD_PCT=2.0
SIGNAL_SELL_THRESHOLD_PCT=-2.0
```

### 8.2. Альтернативы

Для каждого тикера агент:

1. Берёт список альтернатив из `watchlist.alternatives`.
2. Загружает для них цены и делает прогноз в том же запуске.
3. Сравнивает `afterTaxReturnPct`.
4. Если альтернатива даёт лучший after-tax return — предлагает её.

> Примечание: это увеличивает количество вызовов LLM. В MVP приемлемо, но при росте watchlist стоит добавить кэширование или прогнозировать альтернативы реже.

---

## 9. Начальный watchlist

Seed-список UCITS ETF и их альтернатив.

```typescript
const WATCHLIST_SEED = [
  {
    symbol: "SWRD",
    name: "iShares Core MSCI World UCITS ETF",
    category: "World",
    alternatives: ["VWCE", "IWDA", "SWDA"],
  },
  {
    symbol: "EIMI",
    name: "iShares Core MSCI EM IMI UCITS ETF",
    category: "Emerging Markets",
    alternatives: ["EMIM", "IEMA"],
  },
  {
    symbol: "DPYA",
    name: "iShares MSCI World Small Cap UCITS ETF",
    category: "Small Cap",
    alternatives: ["WSML"],
  },
  {
    symbol: "VDTA",
    name: "Vanguard FTSE Developed Europe UCITS ETF",
    category: "Europe",
    alternatives: ["IMEA", "CEU"],
  },
  {
    symbol: "LQDA",
    name: "iShares $ Corp Bond UCITS ETF",
    category: "Bonds",
    alternatives: ["VUCP", "CORP"],
  },
  {
    symbol: "IDVY",
    name: "iShares Euro Dividend UCITS ETF",
    category: "Dividend",
    alternatives: ["DVYE"],
  },
  {
    symbol: "GLDM",
    name: "SPDR Gold MiniShares Trust",
    category: "Gold",
    alternatives: ["SGLN", "PHGP"],
  },
];
```

> Примечание: GLDM технически не UCITS, но доступен европейским инвесторам. При необходимости заменить на `SGLN`.

---

## 10. UI / UX

### 10.1. Страница `/predictions`

**Desktop:**

- Заголовок "Прогнозы UCITS ETF".
- Кнопки: "Обновить прогнозы", "Проверить прогнозы".
- Таблица:
  - Тикер
  - Категория
  - Текущая цена
  - Прогноз цены (7 дней)
  - Ожидаемая доходность (%)
  - После налогов (%)
  - Сигнал (badge: Купить / Продать / Подождать)
  - Альтернатива
  - Confidence
  - Accuracy по истории
  - Reasoning (раскрывающаяся строка / tooltip)

**Mobile:**

- Используем `useIsMobile()`.
- Таблица превращается в карточки.
- Скрываем второстепенные колонки (reasoning, category).

### 10.2. Состояния

- Loading — при загрузке/прогнозе.
- Error — если Yahoo или Ollama недоступны.
- Empty — если прогнозов ещё нет.

### 10.3. Цвета сигналов

| Сигнал | Цвет                         |
| ------ | ---------------------------- |
| Buy    | Зелёный (`colors.success`)   |
| Sell   | Красный (`colors.danger`)    |
| Hold   | Оранжевый (`colors.warning`) |

---

## 11. Порядок реализации

### Этап 1 — База и данные

1. Добавить миграции для `watchlist`, `price_history`, `predictions` в `shared/lib/migrations.ts`.
2. Создать `entities/market-data/model/watchlistSeed.ts`.
3. Создать `app/api/init-watchlist/route.ts`.
4. Создать `entities/market-data/model/yahooFinanceClient.ts`.
5. Создать `app/api/market-data/route.ts`.

### Этап 2 — Логика прогноза

6. Создать `entities/prediction/model/predictionTypes.ts`.
7. Создать `entities/prediction/model/predictionTax.ts`.
8. Создать `entities/prediction/model/predictionSignals.ts`.
9. Создать `entities/prediction/model/predictionAlternatives.ts`.
10. Создать `entities/prediction/model/predictionAccuracy.ts`.
11. Создать `entities/prediction/model/predictionEngine.ts` (промпт + Ollama call).

### Этап 3 — API

12. Создать `app/api/predictions/route.ts`.
13. Создать `app/api/predictions/verify/route.ts`.
14. Создать `features/predictions/api/marketData.ts`.
15. Создать `features/predictions/api/predictions.ts`.
16. Создать `features/predictions/api/verify.ts`.

### Этап 4 — UI

17. Создать `features/predictions/ui/PredictionHeaderMolecule.tsx`.
18. Создать `features/predictions/ui/PredictionTableMolecule.tsx`.
19. Создать `features/predictions/ui/PredictionCardMolecule.tsx`.
20. Создать `features/predictions/ui/PredictionsFeature.tsx`.
21. Создать `app/predictions/page.tsx`.

### Этап 5 — Интеграция и документация

22. Расширить `UserMenuMolecule` до выпадающего меню: "Дашборд", "Правила", "Прогнозы", "Выйти".
23. Обновить `AGENTS.md` и `README.md` описанием новой фичи.
24. Добавить env-переменные в `.env.example` (если есть) и документацию.
25. Протестировать вручную: seed → обновить прогнозы → проверить прогнозы.

---

## 12. Environment Variables

Добавить/использовать:

```bash
# Уже существуют
OLLAMA_API_KEY=...

# Опционально — если нужен кастомный base URL
OLLAMA_BASE_URL=https://api.ollama.com/v1

# Модель для прогнозов (можно переиспользовать qwen3-coder:480b)
PREDICTION_MODEL=qwen3-coder:480b

# Налоговые ставки (хардкод в MVP, но можно вынести)
MOLDOVA_CAPITAL_GAINS_TAX=0.12
UCITS_WITHHOLDING_TAX=0.15

# Пороги сигналов
SIGNAL_BUY_THRESHOLD_PCT=2.0
SIGNAL_SELL_THRESHOLD_PCT=-2.0
```

Пороги загружаются в runtime, без перекомпиляции.

---

## 13. Риски и ограничения

1. **LLM не даёт финансовых гарантий.** Прогнозы — вероятностные, accuracy может быть низкой.
2. **Yahoo Finance нестабилен.** Может отдавать 429, требовать cookie, или менять API. Нужен fallback и retry.
3. **Налоговые ставки могут измениться.** Хардкод 12% — это MVP, не налоговый совет.
4. **Нет реальных сделок.** Фича advisory only, как и весь проект.
5. **GLDM не UCITS.** Если строго следовать "только UCITS", заменить на `SGLN` или `PHGP`.
6. **Продажа без позиции.** Сигнал `Sell` не означает, что у пользователя есть этот ETF. Это рекомендация "если бы был — продал бы".
7. **Rate limits Ollama Cloud.** Прогноз для 7 тикеров × альтернативы = много вызовов. В MVP прогнозируем альтернативы каждый раз, но при росте watchlist нужно кэширование.

---

## 14. Возможные улучшения (после MVP)

- Cron-обновление прогнозов (Vercel Cron).
- Кэширование истории цен в Redis / Vercel KV.
- Более сложные техиндикаторы (RSI, MACD, Bollinger Bands).
- Feedback loop: включать accuracy последних N прогнозов в промпт.
- Дивидендный налог: если вернуться к полному after-tax return.
- Backtesting на истории.
- Уведомления (email/Telegram) при сильном сигнале.

---

## 15. Решения, которые нужно принять перед кодом

| Вопрос                                  | Предложение                                                   | Требует подтверждения |
| --------------------------------------- | ------------------------------------------------------------- | --------------------- |
| Заменить GLDM на UCITS-золото?          | **Нет**, оставляем GLDM                                       | ✅                    |
| Прогнозировать альтернативы каждый раз? | **Да**, прогнозируем вместе с основным тикером                | ✅                    |
| Пороги сигналов 2% / -2%?               | **Да**, фиксированные, вынесены в env                         | ✅                    |
| Показывать reasoning от LLM в UI?       | **Да**, в tooltip/раскрывающейся строке                       | ✅                    |
| Добавить ссылку в `UserMenuMolecule`?   | **Да**, выпадающее меню: Дашборд / Правила / Прогнозы / Выйти | ✅                    |

---

## 16. Финальные решения

| #   | Вопрос                                  | Решение                                        |
| --- | --------------------------------------- | ---------------------------------------------- |
| 1   | Заменить GLDM на UCITS-золото?          | **Нет**, оставляем GLDM                        |
| 2   | Прогнозировать альтернативы каждый раз? | **Да**, прогнозируем вместе с основным тикером |
| 3   | Пороги сигналов 2% / -2%?               | **Да**, фиксированные, вынесены в env          |
| 4   | Показывать reasoning от LLM в UI?       | **Да**, в tooltip/раскрывающейся строке        |
| 5   | Добавить ссылку в `UserMenuMolecule`?   | **Да**, выпадающее меню с пунктами             |

---

_План составлен 2026-06-19. Готов к обсуждению и корректировке перед началом разработки._
