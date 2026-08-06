"use client";

import { colors, radius, spacing, typography } from "@/shared/ui/tokens";

export interface AIExplanationMoleculeProps {
  explanation: string;
  loading: boolean;
}

/**
 * Parse structured analysis text into sections.
 * Sections start with "### 📊" or "### 💡" etc.
 * Falls back to plain text if no sections found.
 */
function parseSections(text: string) {
  const lines = text.split("\n");
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "### 📊 Heading" or "## 💡 Heading" or "# 📊 Heading"
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1].trim(), body: [] };
    } else if (current) {
      if (trimmed) current.body.push(trimmed);
    } else {
      // No section yet — skip or create default
      if (trimmed) {
        current = { heading: "", body: [trimmed] };
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** Render inline markdown: **bold** and `code` */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={i} style={{ fontWeight: typography.fontWeight.bold }}>
          {part.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(<span key={i}>{part}</span>);
    }
  });
  return nodes;
}

export const AIExplanationMolecule = ({
  explanation,
  loading,
}: AIExplanationMoleculeProps) => {
  const sections = parseSections(explanation);

  return (
    <div
      style={{
        marginTop: spacing[6],
        padding: spacing[6],
        backgroundColor: colors.brand[50],
        border: `1px solid ${colors.brand[200]}`,
        borderRadius: radius.lg,
        borderLeft: `4px solid ${colors.brand[500]}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          marginBottom: spacing[4],
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.brand[700],
          fontFamily: typography.fontFamily.sans.join(", "),
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        🤖 AI анализ портфеля
      </div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          lineHeight: typography.lineHeight.relaxed,
          color: colors.neutral[700],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        {loading ? (
          <span
            style={{ display: "flex", alignItems: "center", gap: spacing[2] }}
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
            Анализирую портфель...
          </span>
        ) : sections.length > 0 && sections.some((s) => s.heading) ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[4],
            }}
          >
            {sections.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <div
                    style={{
                      fontSize: typography.fontSize.base,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.neutral[900],
                      marginBottom: spacing[2],
                    }}
                  >
                    {section.heading}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing[2],
                  }}
                >
                  {section.body.map((line, j) => (
                    <div key={j}>{renderInline(line)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          explanation
        )}
      </div>
    </div>
  );
};
