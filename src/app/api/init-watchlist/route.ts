// src/app/api/init-watchlist/route.ts

import { NextResponse } from "next/server";
import {
  upsertWatchlistItem,
  getActiveWatchlist,
} from "@/entities/market-data";
import { WATCHLIST_SEED } from "@/entities/market-data";
import { runMigrations } from "@/shared/lib/migrations";

/** POST /api/init-watchlist — seed the watchlist with 7 default ETFs. Idempotent. */
export async function POST() {
  try {
    await runMigrations();

    for (const item of WATCHLIST_SEED) {
      await upsertWatchlistItem(item);
    }

    const watchlist = await getActiveWatchlist();
    return NextResponse.json({
      message: "Watchlist initialized",
      count: watchlist.length,
      watchlist,
    });
  } catch (error) {
    console.error("Failed to initialize watchlist:", error);
    return NextResponse.json(
      { error: "Failed to initialize watchlist" },
      { status: 500 },
    );
  }
}
