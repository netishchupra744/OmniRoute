import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  cancelProjectRenderJob,
  getProjectRenderJob,
} from "@/lib/db/renderJobs";
import { getVideoProject } from "@/lib/db/videoProjects";

export const dynamic = "force-dynamic";
type RouteContext = {
  params: Promise<{ id: string; jobId: string }> | { id: string; jobId: string };
};

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, jobId } = await params;
  if (!getVideoProject(id)) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }
  const job = getProjectRenderJob(jobId);
  if (!job || job.projectId !== id) {
    return NextResponse.json({ error: "Final render job not found." }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, jobId } = await params;
  const job = getProjectRenderJob(jobId);
  if (!job || job.projectId !== id) {
    return NextResponse.json({ error: "Final render job not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ job: cancelProjectRenderJob(jobId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Render job could not be cancelled." },
      { status: 409 }
    );
  }
}
