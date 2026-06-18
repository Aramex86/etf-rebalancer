"use client";

import { useState, useRef, useCallback } from "react";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { CardAtom } from "@/shared/atoms/CardAtom";
import { colors, radius, spacing, typography } from "@/shared/ui/tokens";
import { useIsMobile } from "@/shared/lib/useMediaQuery";
import { parsePortfolioScreenshot, ParsedPortfolio } from "../api/parse";

export interface PortfolioUploadFeatureProps {
  onPortfolioParsed: (portfolio: ParsedPortfolio) => void;
}

export function PortfolioUploadFeature({
  onPortfolioParsed,
}: PortfolioUploadFeatureProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Пожалуйста, загрузите изображение (PNG, JPG)");
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          setPreview(base64);

          try {
            const portfolio = await parsePortfolioScreenshot(base64);
            onPortfolioParsed(portfolio);
          } catch (err) {
            setError(
              "Не удалось распознать портфель. Попробуйте другой скриншот.",
            );
            console.error(err);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError("Ошибка чтения файла");
        setLoading(false);
      }
    },
    [onPortfolioParsed],
  );

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
        📸 Загрузить портфель
      </h2>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
          marginBottom: spacing[4],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        Перетащите скриншот из Interactive Brokers или нажмите для выбора файла
      </p>

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
          accept="image/*"
          onChange={handleChange}
          style={{ display: "none" }}
        />

        {preview ? (
          <img
            src={preview}
            alt="Preview"
            style={{
              maxWidth: "100%",
              maxHeight: "200px",
              borderRadius: radius.md,
              objectFit: "contain",
            }}
          />
        ) : (
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
                : "Нажмите или перетащите скриншот"}
            </div>
          </div>
        )}

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
            Распознаю позиции...
          </div>
        )}
      </div>

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

      {preview && !loading && (
        <div
          style={{ marginTop: spacing[4], display: "flex", gap: spacing[2] }}
        >
          <ButtonAtom
            variant="secondary"
            size="sm"
            onClick={() => {
              setPreview(null);
              setError(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            🗑️ Очистить
          </ButtonAtom>
        </div>
      )}
    </CardAtom>
  );
}
