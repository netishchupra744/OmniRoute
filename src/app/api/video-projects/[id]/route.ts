import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  deleteVideoProject,
  getVideoProject,
  renameVideoProject,
} from "@/lib/db/videoProjects";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ name: z.string().trim().min(1).max(160) });

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const project = getVideoProject(id);
  return project
    ? NextResponse.json({ project })
    : NextResponse.json({ error: "Video project not found." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid project name is required." }, { status: 400 });
  }
  const project = renameVideoProject(id, parsed.data.name);
  return project
    ? NextResponse.json({ project })
    : NextResponse.json({ error: "Video project not found." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  return deleteVideoProject(id)
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "Video project not found." }, { status: 404 });
}
