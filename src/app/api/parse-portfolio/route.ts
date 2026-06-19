import { NextRequest, NextResponse } from "next/server";
import {
  parseScreenshot,
  savePortfolioSnapshot,
  updatePortfolioRulePrices,
} from "@/entities/portfolio";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const base64Image = image.replace(/^data:image\/[^;]+;base64,/, "");
    console.log(
      "[parse-portfolio] Image received, length:",
      base64Image.length,
    );

    const portfolio = await parseScreenshot(base64Image);

    // 💾 Сохраняем в БД
    const snapshotId = await savePortfolioSnapshot(
      portfolio.totalValue,
      portfolio.positions,
      portfolio.prices,
      portfolio.shares,
    );
    console.log("[parse-portfolio] Snapshot saved, id:", snapshotId);

    // 🔄 Обновляем цены в правилах, чтобы расчёты шли по актуальным ценам
    if (portfolio.prices && Object.keys(portfolio.prices).length > 0) {
      await updatePortfolioRulePrices(portfolio.prices);
      console.log(
        "[parse-portfolio] Updated prices for:",
        Object.keys(portfolio.prices).join(", "),
      );
    }

    return NextResponse.json({ portfolio });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("[parse-portfolio] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse portfolio screenshot" },
      { status: 500 },
    );
  }
}
