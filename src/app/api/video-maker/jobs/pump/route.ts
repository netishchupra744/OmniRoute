import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { runVideoMakerSceneJobPumpOnce } from "@/lib/videoMaker/videoMakerJobPump";

export const dynamic = "force-dynamic";

const schema = z.object({
  online: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(20),
});

function isInternalDesktopPump(request: Request): boolean {
  const expected = process.env.BIJOY_INTERNAL_JOB_SECRET;
  const supplied = request.headers.get("x-bijoy-job-secret");
  if (!expected || !supplied) return false;
  const hostname = new URL(request.url).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isInternalDesktopPump(request)) {
    const authError = await requireManagementAuth(request);
    if (authError) return authError;
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Job pump settings are invalid." }, { status: 400 });
  }
  const result = await runVideoMakerSceneJobPumpOnce(parsed.data);
  return NextResponse.json(result);
}
