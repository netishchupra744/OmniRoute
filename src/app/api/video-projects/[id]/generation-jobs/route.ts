import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { evaluateVideoModelCompatibility } from "@/domain/videoMaker/providerCapabilities";
import { getVideoProject } from "@/lib/db/videoProjects";
import {
  createSceneGenerationJobs,
  listSceneGenerationJobs,
} from "@/lib/db/sceneGenerationJobs";
import { getVideoCapabilityCatalog } from "@/lib/videoMaker/providerCapabilityCatalog";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const createSchema = z.object({
  providerId: z.string().trim().min(1).max(120),
  modelId: z.string().trim().min(1).max(240),
  sceneNumbers: z.array(z.number().int().min(1).max(33)).max(33).optional(),
  fallbackProviderId: z.string().trim().max(120).nullable().optional(),
  fallbackModelId: z.string().trim().max(240).nullable().optional(),
});

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  return NextResponse.json({ jobs: listSceneGenerationJobs(id) });
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const project = getVideoProject(id);
  if (!project) return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Generation job selection is invalid.", details: parsed.error.flatten() }, { status: 400 });
  }
  const model = getVideoCapabilityCatalog().find(
    (item) => item.providerId === parsed.data.providerId && item.modelId === parsed.data.modelId
  );
  if (!model) return NextResponse.json({ error: "Selected video model is not registered." }, { status: 404 });
  const settings = project.settings;
  if (!settings) return NextResponse.json({ error: "Project settings are missing." }, { status: 409 });
  const nativeAudio = settings.audioMode === "NATIVE_VIDEO_AUDIO";
  const compatibility = evaluateVideoModelCompatibility(model, {
    mode: nativeAudio ? "native-video-audio" : "separate-api-voice",
    requiresReferenceImage: true,
    requiresBanglaVoice: nativeAudio,
    requiresLipSync: nativeAudio,
    durationSeconds: settings.sceneDurationSeconds,
    aspectRatio: settings.aspectRatio,
    width: settings.width,
    height: settings.height,
    requiresAsyncJobs: true,
  });
  if (!compatibility.compatible) {
    return NextResponse.json(
      {
        error: "Selected model is not compatible with this presenter project.",
        reasons: compatibility.reasons,
        model,
      },
      { status: 409 }
    );
  }

  const hasFallback = Boolean(parsed.data.fallbackProviderId || parsed.data.fallbackModelId);
  if (hasFallback) {
    if (!parsed.data.fallbackProviderId || !parsed.data.fallbackModelId) {
      return NextResponse.json(
        { error: "Fallback provider and fallback model must be selected together." },
        { status: 400 }
      );
    }
    const fallbackModel = getVideoCapabilityCatalog().find(
      (item) =>
        item.providerId === parsed.data.fallbackProviderId &&
        item.modelId === parsed.data.fallbackModelId
    );
    if (!fallbackModel) {
      return NextResponse.json({ error: "Fallback video model is not registered." }, { status: 404 });
    }
    const fallbackCompatibility = evaluateVideoModelCompatibility(fallbackModel, {
      mode: nativeAudio ? "native-video-audio" : "separate-api-voice",
      requiresReferenceImage: true,
      requiresBanglaVoice: nativeAudio,
      requiresLipSync: nativeAudio,
      durationSeconds: settings.sceneDurationSeconds,
      aspectRatio: settings.aspectRatio,
      width: settings.width,
      height: settings.height,
      requiresAsyncJobs: true,
    });
    if (!fallbackCompatibility.compatible) {
      return NextResponse.json(
        {
          error: "Fallback model is not compatible with this presenter project.",
          reasons: fallbackCompatibility.reasons,
          model: fallbackModel,
        },
        { status: 409 }
      );
    }
  }

  try {
    const jobs = createSceneGenerationJobs({ projectId: id, ...parsed.data });
    return NextResponse.json({ jobs }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation jobs could not be created.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
