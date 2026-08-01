import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getVideoCapabilityCatalog,
  getVideoCapabilityReport,
} from "@/lib/videoMaker/providerCapabilityCatalog";

export const dynamic = "force-dynamic";

const requirementsSchema = z.object({
  mode: z.enum(["native-video-audio", "separate-api-voice"]).default("native-video-audio"),
  requiresReferenceImage: z.boolean().default(true),
  requiresBanglaVoice: z.boolean().default(true),
  requiresLipSync: z.boolean().default(true),
  durationSeconds: z.literal(10).default(10),
  aspectRatio: z.literal("16:9").default("16:9"),
  width: z.literal(1920).default(1920),
  height: z.literal(1080).default(1080),
  requiresAsyncJobs: z.boolean().default(true),
  finalRendering: z.boolean().default(false),
});

export async function GET(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const includeLocal = url.searchParams.get("includeLocal") === "true";
  return NextResponse.json({ models: getVideoCapabilityCatalog({ includeLocal }) });
}

export async function POST(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requirementsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Capability requirements are invalid." }, { status: 400 });
  }
  const report = getVideoCapabilityReport(parsed.data);
  return NextResponse.json({
    requirements: parsed.data,
    compatibleModels: report.filter((item) => item.compatible).map((item) => item.model),
    report,
    warning:
      "Compatibility is conservative. A model is not selectable for presenter generation until every required capability is source-verified or contract-tested.",
  });
}
