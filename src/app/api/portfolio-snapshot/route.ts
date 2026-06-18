import { NextResponse } from "next/server";
import { getLatestPortfolioSnapshot } from "@/entities/portfolio";
import { runMigrations } from "@/shared/lib/migrations";

export async function GET() {
  try {
    await runMigrations();
    const snapshot = await getLatestPortfolioSnapshot();
    if (!snapshot) {
      return NextResponse.json({ portfolio: null });
    }
    return NextResponse.json({
      portfolio: {
        totalValue: snapshot.totalValue,
        positions: snapshot.positions,
        prices: snapshot.prices,
        shares: snapshot.shares,
      },
    });
  } catch (error: unknown) {
    console.error("[portfolio-snapshot] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
