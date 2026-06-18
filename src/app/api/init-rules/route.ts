import { NextResponse } from "next/server";
import { getTargetAllocations, savePortfolioRule } from "@/entities/portfolio";
import { runMigrations } from "@/shared/lib/migrations";
import { ETF_UNIVERSE } from "@/entities/etf";

export async function POST() {
  try {
    await runMigrations();

    const existingRules = await getTargetAllocations();

    if (Object.keys(existingRules).length > 0) {
      return NextResponse.json({
        message: "Rules already initialized",
        rules: existingRules,
      });
    }

    for (const etf of ETF_UNIVERSE) {
      await savePortfolioRule({
        symbol: etf.symbol,
        name: etf.name,
        targetWeight: etf.targetAllocation,
        price: etf.price,
      });
    }

    const rules = await getTargetAllocations();
    return NextResponse.json({ message: "Rules initialized", rules });
  } catch (error) {
    console.error("Failed to initialize rules:", error);
    return NextResponse.json(
      { error: "Failed to initialize rules" },
      { status: 500 },
    );
  }
}
