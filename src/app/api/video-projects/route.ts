import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createVideoProject, listVideoProjects } from "@/lib/db/videoProjects";
import { VIDEO_PROJECT_STATUSES } from "@/domain/videoMaker/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  videoTitle: z.string().trim().min(1).max(300),
  language: z.string().trim().min(2).max(24).default("bn"),
  videoType: z.string().trim().min(1).max(80).default("YOUTUBE_TUTORIAL"),
  avatarProfileId: z.string().uuid().nullable().optional(),
  llmModelId: z.string().trim().min(1).max(240).nullable().optional(),
  voiceProviderId: z.string().trim().max(120).nullable().optional(),
  voiceModelId: z.string().trim().max(200).nullable().optional(),
  videoProviderId: z.string().trim().max(120).nullable().optional(),
  videoModelId: z.string().trim().max(200).nullable().optional(),
  imageProviderId: z.string().trim().max(120).nullable().optional(),
  imageModelId: z.string().trim().max(200).nullable().optional(),
  musicProviderId: z.string().trim().max(120).nullable().optional(),
  musicModelId: z.string().trim().max(200).nullable().optional(),
  renderProviderId: z.string().trim().max(120).nullable().optional(),
  renderModelId: z.string().trim().max(200).nullable().optional(),
  visualStyle: z.string().trim().min(1).max(200).default("Realistic YouTube Presenter"),
  aspectRatio: z.literal("16:9").default("16:9"),
  sceneCount: z.literal(33).default(33),
  sceneDurationSeconds: z.literal(10).default(10),
  width: z.literal(1920).default(1920),
  height: z.literal(1080).default(1080),
  audioMode: z.enum(["NATIVE_VIDEO_AUDIO", "SEPARATE_API_VOICE"]).default("NATIVE_VIDEO_AUDIO"),
  channelBrandingEnabled: z.boolean().default(false),
  sourceMaterial: z.string().max(100_000).nullable().optional(),
});

export async function GET(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const statusValue = url.searchParams.get("status");
  const status = VIDEO_PROJECT_STATUSES.includes(statusValue as never)
    ? (statusValue as (typeof VIDEO_PROJECT_STATUSES)[number])
    : undefined;
  const limit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    return NextResponse.json({
      projects: listVideoProjects({
        status,
        search: url.searchParams.get("search") || undefined,
        limit: Number.isFinite(limit) ? limit : 100,
        offset: Number.isFinite(offset) ? offset : 0,
      }),
    });
  } catch (error) {
    console.error("[BijoyVideoMaker] Failed to list projects:", error);
    return NextResponse.json({ error: "Failed to load video projects." }, { status: 500 });
  }
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Video project settings are invalid.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const project = createVideoProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[BijoyVideoMaker] Failed to create project:", error);
    const message = error instanceof Error ? error.message : "Failed to create video project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
