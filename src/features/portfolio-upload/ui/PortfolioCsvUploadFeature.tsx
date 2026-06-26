// src/features/portfolio-upload/ui/PortfolioCsvUploadFeature.tsx
// CSV upload with drag-and-drop, preview table, and confirm step

"use client";

import { useState, useRef, useCallback } from "react";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import {
  parsePortfolioCsv,
  type ParsedPortfolio,
  type CsvParseResponse,
} from "../api/parseCsv";

export interface PortfolioCsvUploadFeatureProps {
  onPortfolioParsed: (portfolio: ParsedPortfolio) => void;
}

interface PreviewRow {
  symbol: string;
  shares: number;
  price: number;
  marketValue: number;
}

export function PortfolioCsvUploadFeature({
  onPortfolioParsed,
}: PortfolioCsvUploadFeatureProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvResponse, setCsvResponse] = useState<CsvParseResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFile = useCallback(async (file: File) => {
    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      setError("Пожалуйста, загрузите CSV файл");
      return;
    }

    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const text = await file.text();

      const response = await parsePortfolioCsv(text);
      setCsvResponse(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось распознать CSV. Проверьте формат файла.",
      );
      setCsvResponse(null);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile],
  );

  const handleConfirm = useCallback(() => {
    if (csvResponse) {
      onPortfolioParsed(csvResponse.portfolio);
      setCsvResponse(null);
      setFileName(null);
    }
  }, [csvResponse, onPortfolioParsed]);

  const handleCancel = useCallback(() => {
    setCsvResponse(null);
    setFileName(null);
    setError(null);
  }, []);

  // Build preview rows from parsed portfolio
  const previewRows: PreviewRow[] = csvResponse
    ? Object.entries(csvResponse.portfolio.positions).map(
        ([symbol, value]) => ({
          symbol,
          shares: csvResponse.portfolio.shares?.[symbol] ?? 0,
          price: csvResponse.portfolio.prices?.[symbol] ?? 0,
          marketValue: value,
        }),
      )
    : [];

  return (
    <CardAtom>
      <h2
        style={{
          fontSize: typography.fontSize.xl,
          fontWeight: typography.fontWeight.semibold,
          color: colors.neutral[900],
          marginBottom: spacing[4],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        📄 Загрузить портфель (CSV)
      </h2>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
          marginBottom: spacing[4],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        Экспортируйте Activity Statement из IB TWS и перетащите CSV сюда
      </p>

      {/* Drag-and-drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? colors.brand[400] : colors.neutral[300]}`,
          borderRadius: radius.lg,
          padding: isMobile ? spacing[5] : spacing[8],
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: dragActive ? colors.brand[50] : colors.neutral[0],
          transition: "all 200ms ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,application/vnd.ms-excel"
          onChange={handleChange}
          style={{ display: "none" }}
        />

        <div style={{ color: colors.neutral[400] }}>
          <div
            style={{
              fontSize: isMobile ? "36px" : "48px",
              marginBottom: spacing[2],
            }}
          >
            📁
          </div>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            {dragActive
              ? "Отпустите файл здесь"
              : fileName
                ? `📄 ${fileName}`
                : "Нажмите или перетащите CSV файл"}
          </div>
        </div>

        {loading && (
          <div
            style={{
              marginTop: spacing[4],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[2],
              color: colors.brand[600],
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: spacing[4],
                height: spacing[4],
                border: `2px solid ${colors.brand[200]}`,
                borderTopColor: colors.brand[500],
                borderRadius: radius.full,
                animation: "spin 1s linear infinite",
              }}
            />
            Парсинг CSV...
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: spacing[4],
            padding: spacing[3],
            backgroundColor: colors.danger[50],
            border: `1px solid ${colors.danger[200]}`,
            borderRadius: radius.md,
            color: colors.danger[700],
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Warnings */}
      {csvResponse && csvResponse.warnings.length > 0 && (
        <div
          style={{
            marginTop: spacing[4],
            padding: spacing[3],
            backgroundColor: colors.warning[50],
            border: `1px solid ${colors.warning[200]}`,
            borderRadius: radius.md,
            color: colors.warning[700],
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          {csvResponse.warnings.map((w, i) => (
            <div key={i}>
              ⚠️ {w.symbol}: {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Unknown symbols */}
      {csvResponse && csvResponse.unknownSymbols.length > 0 && (
        <div
          style={{
            marginTop: spacing[3],
            padding: spacing[3],
            backgroundColor: colors.neutral[50],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: radius.md,
            color: colors.neutral[600],
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.sans.join(", "),
          }}
        >
          ℹ️ Неизвестные символы (не в портфеле):{" "}
          {csvResponse.unknownSymbols.join(", ")}
        </div>
      )}

      {/* Preview table */}
      {csvResponse && previewRows.length > 0 && (
        <div
          style={{
            marginTop: spacing[4],
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily.sans.join(", "),
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `2px solid ${colors.neutral[200]}`,
                }}
              >
                <th style={headerCellStyle}>Symbol</th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>
                  Shares
                </th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>
                  Price
                </th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr
                  key={row.symbol}
                  style={{
                    borderBottom: `1px solid ${colors.neutral[100]}`,
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.neutral[900],
                    }}
                  >
                    {row.symbol}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    {row.shares}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    ${row.price.toFixed(2)}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    $
                    {row.marketValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr
                style={{
                  borderTop: `2px solid ${colors.neutral[300]}`,
                  fontWeight: typography.fontWeight.bold,
                }}
              >
                <td
                  style={{
                    ...cellStyle,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.neutral[900],
                  }}
                >
                  Total
                </td>
                <td style={cellStyle} />
                <td style={cellStyle} />
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    fontWeight: typography.fontWeight.bold,
                    color: colors.neutral[900],
                  }}
                >
                  $
                  {csvResponse.portfolio.totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Confirm / Cancel buttons */}
          <div
            style={{
              marginTop: spacing[4],
              display: "flex",
              gap: spacing[3],
              justifyContent: "flex-end",
            }}
          >
            <ButtonAtom variant="secondary" size="sm" onClick={handleCancel}>
              Отмена
            </ButtonAtom>
            <ButtonAtom variant="primary" size="sm" onClick={handleConfirm}>
              ✅ Подтвердить
            </ButtonAtom>
          </div>
        </div>
      )}
    </CardAtom>
  );
}

// Shared cell styles
const headerCellStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  textAlign: "left",
  fontWeight: typography.fontWeight.semibold,
  color: colors.neutral[600],
  fontSize: typography.fontSize.xs,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const cellStyle: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  color: colors.neutral[700],
};
