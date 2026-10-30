// src/entities/portfolio/model/parseCsvStatement.ts
// Parse IB Activity Statement CSV (RU + EN locales) into portfolio snapshot

import type { ParsedPortfolio } from "./parseScreenshotTool";

/** Section headers in both Russian and English */
const SECTION_HEADERS = {
  openPositions: ["Открытые позиции", "Open Positions"],
  nav: ["Чистая стоимость активов (NAV)", "Net Asset Value"],
} as const;

/** Row type markers */
const DATA_ROW = "Data";
const SUMMARY_ROW = "Summary";
const TOTAL_ROW = new Set(["Всего", "Total"]);
const TOTAL_ALL_ROW = new Set(["Всего (все активы)", "Total (all assets)"]);

/** Known ETF symbols from the portfolio universe */
const KNOWN_SYMBOLS = [
  "SWRD",
  "EIMI",
  "DPYA",
  "VDTA",
  "LQDA",
  "IDVY",
  "GLDM",
] as const;

export interface CsvParseWarning {
  symbol: string;
  message: string;
}

export interface CsvParseResult {
  portfolio: ParsedPortfolio;
  warnings: CsvParseWarning[];
  /** Unknown symbols found in the CSV (not in KNOWN_SYMBOLS) */
  unknownSymbols: string[];
}

/**
 * Minimal CSV line parser — handles quoted fields with commas inside.
 * @internal
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote ""
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/** Check if a section name matches any of the localized variants */
function isSectionMatch(section: string, variants: readonly string[]): boolean {
  return variants.some((v) => section.startsWith(v));
}

/** Check if a value field is a "Total" row */
function isTotalRow(value: string): boolean {
  return TOTAL_ROW.has(value) || TOTAL_ALL_ROW.has(value);
}

/**
 * Parse IB Activity Statement CSV into a portfolio snapshot.
 *
 * Extracts:
 * - Open Positions section → symbol, shares, closing price, market value
 * - NAV section → total portfolio value
 *
 * Supports both Russian and English IB statement localizations.
 *
 * @param csvText - Raw CSV text from IB TWS export
 * @returns Parsed portfolio data with warnings and unknown symbols
 * @throws Error if required sections are not found
 */

interface ParsedPositions {
  positions: Record<string, number>;
  prices: Record<string, number>;
  shares: Record<string, number>;
  unknownSymbols: string[];
}

/** Find the starting index of a section by its header row */
function findSectionStart(
  parsedLines: string[][],
  variants: readonly string[],
): number {
  for (let i = 0; i < parsedLines.length; i++) {
    const section = parsedLines[i][0];
    if (
      section &&
      isSectionMatch(section, variants) &&
      parsedLines[i][1] === "Header"
    ) {
      return i;
    }
  }
  return -1;
}

/** Check if asset class is a stock/ETF */
function isStockAsset(assetClass: string): boolean {
  return !assetClass || ["Акции", "Stocks"].includes(assetClass);
}

/**
 * Parse IB number formats such as 12 358,32, 12,358.32, and 12358.32.
 */
function parseLocalizedNumber(
  value: string,
  preferDecimal = false,
): number | null {
  const normalized = value
    .replace(/[\s\u00a0\u202f']/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!normalized || normalized === "-") return null;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);
  let numeric = normalized;

  if (lastSeparator >= 0) {
    const separator = normalized[lastSeparator];
    const trailingDigits = normalized.length - lastSeparator - 1;
    const groups = normalized.split(separator);
    const isThousandsGrouping =
      !preferDecimal &&
      trailingDigits === 3 &&
      groups[0].replace("-", "").length >= 1 &&
      groups[0].replace("-", "").length <= 3 &&
      groups.slice(1).every((group) => group.length === 3);

    if (!isThousandsGrouping) {
      numeric =
        normalized.slice(0, lastSeparator).replace(/[,.]/g, "") +
        "." +
        normalized.slice(lastSeparator + 1).replace(/[,.]/g, "");
    } else {
      numeric = normalized.replace(/[,.]/g, "");
    }
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColumnName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-zа-яё]/g, "");
}

function findColumnIndex(
  headers: string[],
  aliases: readonly string[],
  fallback: number,
): number {
  const normalizedAliases = aliases.map(normalizeColumnName);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeColumnName(header)),
  );
  return index === -1 ? fallback : index;
}

/** Validate and parse numeric fields from a position row */
function parsePositionNumbers(
  quantityStr: string,
  closePriceStr: string,
  marketValueStr: string,
) {
  const quantity = parseLocalizedNumber(quantityStr);
  const closePrice = parseLocalizedNumber(closePriceStr, true);
  const marketValue = parseLocalizedNumber(marketValueStr);

  if (quantity === null || closePrice === null || marketValue === null) {
    return null;
  }
  return { quantity, closePrice, marketValue };
}

/** Parse Open Positions data rows into positions/prices/shares */
function parseOpenPositions(
  parsedLines: string[][],
  startIndex: number,
): ParsedPositions {
  const positions: Record<string, number> = {};
  const prices: Record<string, number> = {};
  const shares: Record<string, number> = {};
  const unknownSymbols: string[] = [];
  const headers = parsedLines[startIndex].slice(2);
  const assetClassColumn = findColumnIndex(
    headers,
    ["Asset Category", "Asset Class", "Класс активов", "Категория активов"],
    1,
  );
  const symbolColumn = findColumnIndex(
    headers,
    ["Symbol", "Ticker", "Символ"],
    3,
  );
  const quantityColumn = findColumnIndex(
    headers,
    ["Quantity", "Shares", "Количество", "Позиция"],
    4,
  );
  const closePriceColumn = findColumnIndex(
    headers,
    ["Close Price", "Last Price", "Цена закрытия", "Последняя цена"],
    8,
  );
  const marketValueColumn = findColumnIndex(
    headers,
    ["Value", "Market Value", "Стоимость", "Рыночная стоимость"],
    9,
  );

  for (let i = startIndex + 1; i < parsedLines.length; i++) {
    const [section, rowType, ...rest] = parsedLines[i];

    if (section && !isSectionMatch(section, SECTION_HEADERS.openPositions))
      break;
    if (rowType !== DATA_ROW || rest[0] !== SUMMARY_ROW) continue;

    const assetClass = rest[assetClassColumn] ?? "";
    const symbol = rest[symbolColumn];
    const quantityStr = rest[quantityColumn];
    const closePriceStr = rest[closePriceColumn];
    const marketValueStr = rest[marketValueColumn];

    if (!symbol || !quantityStr || !closePriceStr || !marketValueStr) continue;
    if (!isStockAsset(assetClass)) continue;

    const numbers = parsePositionNumbers(
      quantityStr,
      closePriceStr,
      marketValueStr,
    );
    if (!numbers) continue;

    if (!KNOWN_SYMBOLS.includes(symbol as (typeof KNOWN_SYMBOLS)[number])) {
      unknownSymbols.push(symbol);
      continue;
    }

    positions[symbol] = numbers.marketValue;
    prices[symbol] = numbers.closePrice;
    shares[symbol] = numbers.quantity;
  }

  return { positions, prices, shares, unknownSymbols };
}

/** Try to extract total value from a single NAV data row */
function tryExtractNavTotal(navRest: string[]): number | null {
  const assetClass = navRest[0];
  if (!isTotalRow(assetClass)) return null;

  // rest[4] = "Текущий итог" / "Current Total"
  return parseLocalizedNumber(navRest[4]);
}

/** Extract total portfolio value from NAV section */
function parseNavTotal(parsedLines: string[][]): {
  totalValue: number;
  found: boolean;
} {
  for (let i = 0; i < parsedLines.length; i++) {
    const section = parsedLines[i][0];
    if (!section || !isSectionMatch(section, SECTION_HEADERS.nav)) continue;

    for (let j = i + 1; j < parsedLines.length; j++) {
      const [navSection, navRowType, ...navRest] = parsedLines[j];

      if (navSection && !isSectionMatch(navSection, SECTION_HEADERS.nav)) break;
      if (navRowType !== DATA_ROW) continue;

      const total = tryExtractNavTotal(navRest);
      if (total !== null) return { totalValue: total, found: true };
    }
  }

  return { totalValue: 0, found: false };
}

/** Build warnings for missing ETFs and NAV fallback */
function buildWarnings(
  positions: Record<string, number>,
  foundNav: boolean,
): CsvParseWarning[] {
  const warnings: CsvParseWarning[] = [];

  for (const symbol of KNOWN_SYMBOLS) {
    if (!(symbol in positions)) {
      warnings.push({
        symbol,
        message: `ETF ${symbol} not found in CSV positions`,
      });
    }
  }

  if (!foundNav) {
    warnings.push({
      symbol: "PORTFOLIO",
      message: "NAV section not found, total value calculated from positions",
    });
  }

  return warnings;
}

export function parseCsvStatement(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const parsedLines = lines.map(parseCsvLine);

  // --- Find Open Positions section ---
  const openPositionsStart = findSectionStart(
    parsedLines,
    SECTION_HEADERS.openPositions,
  );

  if (openPositionsStart === -1) {
    throw new Error(
      'Section "Открытые позиции" / "Open Positions" not found in CSV',
    );
  }

  // --- Parse Open Positions data rows ---
  const { positions, prices, shares, unknownSymbols } = parseOpenPositions(
    parsedLines,
    openPositionsStart,
  );

  // --- Find NAV section for total value ---
  const { totalValue: navTotal, found: foundNav } = parseNavTotal(parsedLines);

  // --- Validation & Warnings ---
  const warnings = buildWarnings(positions, foundNav);

  // If NAV total not found, calculate from positions
  const totalValue = foundNav
    ? navTotal
    : Object.values(positions).reduce((sum, v) => sum + v, 0);

  // Check if we have any positions at all
  if (Object.keys(positions).length === 0) {
    throw new Error(
      "No valid ETF positions found in CSV. Check file format and try again.",
    );
  }

  const portfolio: ParsedPortfolio = {
    totalValue,
    positions,
    prices,
    shares,
  };

  return { portfolio, warnings, unknownSymbols };
}
