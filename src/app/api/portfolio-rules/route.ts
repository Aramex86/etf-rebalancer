import { NextResponse } from "next/server";
import {
  getPortfolioRules,
  savePortfolioRule,
} from "@/entities/portfolio";
import { runMigrations } from "@/shared/lib/migrations";

export async function GET() {
  try {
    await runMigrations();
    const rules = await getPortfolioRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Failed to fetch portfolio rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio rules" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await runMigrations();
    const body = await req.json();
    const { symbol, name, targetWeight, price } = body;

    if (!symbol || typeof targetWeight !== "number") {
      return NextResponse.json(
        { error: "symbol and targetWeight are required" },
        { status: 400 },
      );
    }

    await savePortfolioRule({ symbol, name, targetWeight, price });
    const rules = await getPortfolioRules();

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Failed to save portfolio rule:", error);
    return NextResponse.json(
      { error: "Failed to save portfolio rule" },
      { status: 500 },
    );
  }
}
