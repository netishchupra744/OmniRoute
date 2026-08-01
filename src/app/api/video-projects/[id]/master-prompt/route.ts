import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVideoProject } from "@/lib/db/videoProjects";
import {
  getCurrentMasterPrompt,
  listMasterPromptVersions,
  restoreMasterPromptVersion,
  saveManualMasterPromptVersion,
} from "@/lib/db/videoProjectPlans";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), promptText: z.string().trim().min(1).max(200_000) }),
  z.object({ action: z.literal("restore"), promptVersionId: z.string().uuid() }),
]);

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  return NextResponse.json({
    current: getCurrentMasterPrompt(id),
    versions: listMasterPromptVersions(id),
  });
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Master Prompt change is invalid." }, { status: 400 });
  }
  try {
    const current = parsed.data.action === "edit"
      ? saveManualMasterPromptVersion({ projectId: id, promptText: parsed.data.promptText })
      : restoreMasterPromptVersion({ projectId: id, promptVersionId: parsed.data.promptVersionId });
    return NextResponse.json({ current, versions: listMasterPromptVersions(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Master Prompt could not be changed." },
      { status: 400 }
    );
  }
}
