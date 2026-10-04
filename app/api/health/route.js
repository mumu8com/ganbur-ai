import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const aiConfigured = Boolean(
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  );

  return NextResponse.json({
    ok: true,
    service: "ganbur-ai",
    aiConfigured,
    provider: process.env.OPENROUTER_API_KEY ? "openrouter" : "openai",
    timestamp: new Date().toISOString()
  }, {
    headers: {"Cache-Control": "no-store"}
  });
}
