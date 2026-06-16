import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRouteMetrics } from "@/lib/observability/metrics";
import { isQueueEnabled, getRedis } from "@/lib/queue/connection";

export const dynamic = "force-dynamic";

export const GET = withRouteMetrics("/api/health", async () => {
  const timestamp = new Date().toISOString();
  let database: "connected" | "error" = "connected";
  let redis: "connected" | "error" | "disabled" = isQueueEnabled()
    ? "connected"
    : "disabled";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  if (isQueueEnabled()) {
    try {
      const pong = await getRedis().ping();
      if (pong !== "PONG") redis = "error";
    } catch {
      redis = "error";
    }
  }

  const degraded = database === "error" || redis === "error";
  if (degraded) {
    return NextResponse.json(
      { status: "degraded", database, redis, timestamp },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    version: "0.1.0",
    database,
    redis,
    timestamp,
  });
});
