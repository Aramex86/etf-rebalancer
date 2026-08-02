// src/features/backtest/ui/PortfolioChart.tsx

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { colors, spacing, typography } from "@/shared/ui/tokens";
import type { BacktestSnapshotRecord } from "@/entities/backtest";

interface PortfolioChartProps {
  snapshots: BacktestSnapshotRecord[];
  startingCapital: number;
}

interface ChartDatum {
  week: number;
  date: string;
  portfolio: number;
  buyHold?: number;
}

/**
 * Portfolio value chart over time (weekly snapshots).
 * Shows the agent's portfolio value vs the starting capital line.
 */
export function PortfolioChart({
  snapshots,
  startingCapital,
}: PortfolioChartProps) {
  if (snapshots.length === 0) {
    return null;
  }

  const data: ChartDatum[] = snapshots.map((s) => ({
    week: s.week,
    date: s.date,
    portfolio: Number(s.totalValue.toFixed(2)),
  }));

  const values = data.map((d) => d.portfolio);
  const minVal = Math.min(...values, startingCapital);
  const maxVal = Math.max(...values, startingCapital);
  const padding = (maxVal - minVal) * 0.1 || 50;
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);

  const fmtUsd = (v: number) => `$${v.toFixed(0)}`;

  return (
    <div
      style={{
        width: "100%",
        height: 320,
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.5rem",
        padding: spacing[4],
      }}
    >
      <div
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.neutral[700],
          fontFamily: typography.fontFamily.sans.join(", "),
          marginBottom: spacing[3],
        }}
      >
        📈 Стоимость портфеля по неделям
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            label={{
              value: "Неделя",
              position: "insideBottom",
              offset: -2,
              style: {
                fontSize: 11,
                fill: colors.neutral[500],
              },
            }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 11, fill: colors.neutral[500] }}
            tickFormatter={fmtUsd}
            width={60}
          />
          <Tooltip
            formatter={(v) => fmtUsd(Number(v))}
            labelFormatter={(label) => `Неделя ${label}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: "0.5rem",
              border: `1px solid ${colors.neutral[200]}`,
            }}
          />
          <ReferenceLine
            y={startingCapital}
            stroke={colors.neutral[400]}
            strokeDasharray="5 5"
            label={{
              value: `Старт: ${fmtUsd(startingCapital)}`,
              position: "right",
              style: { fontSize: 10, fill: colors.neutral[400] },
            }}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke={colors.brand[500]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="Портфель"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
