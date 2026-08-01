import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { duplicateVideoProject } from "@/lib/db/videoProjects";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const schema = z.object({ name: z.string().trim().min(1).max(160).optional() });

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Duplicate project name is invalid." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      { project: duplicateVideoProject(id, parsed.data.name) },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project could not be duplicated.";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
