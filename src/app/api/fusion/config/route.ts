import { NextResponse } from "next/server";
import { getFusionConfig, saveFusionConfig } from "@/lib/ai/fusion-config";
import { requireUser } from "@/lib/api";

export async function GET() {
  try {
    await requireUser();
    const config = await getFusionConfig();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    if (!body.config) {
      return NextResponse.json({ success: false, error: "Missing config parameter" }, { status: 400 });
    }
    await saveFusionConfig(body.config);
    return NextResponse.json({ success: true, config: body.config });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
