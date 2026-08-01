import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVideoProject } from "@/lib/db/videoProjects";
import { listProjectScenes, setSceneLocked } from "@/lib/db/videoProjectPlans";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const patchSchema = z.object({ sceneId: z.string().uuid(), locked: z.boolean() });

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  return NextResponse.json({ scenes: listProjectScenes(id) });
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid scene lock change is required." }, { status: 400 });
  }
  const scene = listProjectScenes(id).find((item) => item.id === parsed.data.sceneId);
  if (!scene) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
  setSceneLocked(scene.id, parsed.data.locked);
  return NextResponse.json({ scene: listProjectScenes(id).find((item) => item.id === scene.id) });
}
