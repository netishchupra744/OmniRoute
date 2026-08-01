import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  createFinalRenderJobStore,
  createProjectRenderJob,
  listProjectRenderJobs,
} from "@/lib/db/renderJobs";
import { getVideoProject } from "@/lib/db/videoProjects";
import { validateProviderOutputUrl } from "@/lib/videoMaker/outputSecurity";
import { advanceFinalRenderJob } from "@/lib/videoMaker/finalRenderOrchestrator";
import { getFinalRenderProviderAdapter } from "@/lib/videoMaker/finalRenderProviders";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const renderSchema = z.object({
  providerId: z.string().trim().min(1).max(120).optional(),
  modelId: z.string().trim().max(240).nullable().optional(),
  options: z
    .object({
      subtitles: z.boolean().optional(),
      logoUrl: z.string().url().nullable().optional(),
      backgroundMusicUrl: z.string().url().nullable().optional(),
      soundEffects: z.boolean().optional(),
      titleCard: z.boolean().optional(),
      outroBranding: z.boolean().optional(),
    })
    .default({}),
});

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  return NextResponse.json({ jobs: listProjectRenderJobs(id) });
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const project = getVideoProject(id);
  if (!project) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  const parsed = renderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Final render settings are invalid.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.options.logoUrl) validateProviderOutputUrl(parsed.data.options.logoUrl);
    if (parsed.data.options.backgroundMusicUrl) {
      validateProviderOutputUrl(parsed.data.options.backgroundMusicUrl);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Render asset URL is not allowed." },
      { status: 400 }
    );
  }

  const providerId = parsed.data.providerId ?? project.settings?.renderProviderId;
  const modelId = parsed.data.modelId ?? project.settings?.renderModelId ?? null;
  if (!providerId) {
    return NextResponse.json({ error: "Render provider not configured." }, { status: 409 });
  }
  const adapter = getFinalRenderProviderAdapter(providerId);
  if (!adapter) {
    return NextResponse.json(
      {
        error: "Render provider not configured.",
        providerId,
        detail: "Install or connect a verified API-based final render adapter before rendering.",
      },
      { status: 409 }
    );
  }

  try {
    const queued = createProjectRenderJob({
      projectId: id,
      providerId,
      modelId,
      options: parsed.data.options,
    });
    const job = await advanceFinalRenderJob({
      jobId: queued.id,
      store: createFinalRenderJobStore(),
      adapter,
    });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final render job could not be created.";
    const status = /exactly 33|Scene \d+|completed video output|exactly 10/.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
