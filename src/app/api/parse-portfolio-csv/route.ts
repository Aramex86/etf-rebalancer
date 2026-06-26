// src/app/api/parse-portfolio-csv/route.ts
// Parse IB Activity Statement CSV → save snapshot + update rule prices

import { NextRequest, NextResponse } from "next/server";
import {
  parseCsvStatement,
  savePortfolioSnapshot,
  updatePortfolioRulePrices,
} from "@/entities/portfolio";

export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json();

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "CSV text is required" },
        { status: 400 },
      );
    }

    console.log("[parse-portfolio-csv] CSV received, length:", csv.length);

    // Parse CSV — may throw on format errors
    const { portfolio, warnings, unknownSymbols } = parseCsvStatement(csv);

    console.log(
      "[parse-portfolio-csv] Parsed positions:",
      Object.keys(portfolio.positions).join(", "),
      "| Total: $",
      portfolio.totalValue,
    );

    // 💾 Save snapshot to DB
    const snapshotId = await savePortfolioSnapshot(
      portfolio.totalValue,
      portfolio.positions,
      portfolio.prices,
      portfolio.shares,
    );
    console.log("[parse-portfolio-csv] Snapshot saved, id:", snapshotId);

    // 🔄 Auto-update prices in portfolio_rules
    if (portfolio.prices && Object.keys(portfolio.prices).length > 0) {
      await updatePortfolioRulePrices(portfolio.prices);
      console.log(
        "[parse-portfolio-csv] Updated prices for:",
        Object.keys(portfolio.prices).join(", "),
      );
    }

    return NextResponse.json({
      portfolio,
      warnings,
      unknownSymbols,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("[parse-portfolio-csv] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse CSV" },
      { status: 500 },
    );
  }
}
