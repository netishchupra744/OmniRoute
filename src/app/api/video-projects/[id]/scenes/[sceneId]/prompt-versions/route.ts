import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVideoProject } from "@/lib/db/videoProjects";
import {
  getProjectScene,
  listScenePromptVersions,
  restoreScenePromptVersion,
  saveScenePromptVersion,
} from "@/lib/db/videoProjectPlans";

export const dynamic = "force-dynamic";
type RouteContext = {
  params: Promise<{ id: string; sceneId: string }> | { id: string; sceneId: string };
};
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    promptText: z.string().trim().min(1).max(250_000),
    exactDialogue: z.string().trim().min(1).max(1_000),
  }),
  z.object({ action: z.literal("restore"), promptVersionId: z.string().uuid() }),
]);

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, sceneId } = await params;
  if (!getVideoProject(id)) return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  const scene = getProjectScene(id, sceneId);
  if (!scene) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
  return NextResponse.json({ scene, versions: listScenePromptVersions(id, sceneId) });
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, sceneId } = await params;
  if (!getVideoProject(id)) return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Scene prompt change is invalid." }, { status: 400 });
  }
  try {
    const scene = parsed.data.action === "edit"
      ? saveScenePromptVersion({
          projectId: id,
          sceneId,
          promptText: parsed.data.promptText,
          exactDialogue: parsed.data.exactDialogue,
        })
      : restoreScenePromptVersion({
          projectId: id,
          sceneId,
          promptVersionId: parsed.data.promptVersionId,
        });
    return NextResponse.json({ scene, versions: listScenePromptVersions(id, sceneId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scene prompt could not be changed.";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 409 });
  }
}
