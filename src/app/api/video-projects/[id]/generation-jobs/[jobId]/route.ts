import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  cancelSceneGenerationJob,
  getSceneGenerationJob,
  restartSceneGenerationJob,
} from "@/lib/db/sceneGenerationJobs";

type RouteContext = { params: Promise<{ id: string; jobId: string }> | { id: string; jobId: string } };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, jobId } = await params;
  const job = getSceneGenerationJob(jobId);
  return job && job.projectId === id
    ? NextResponse.json({ job })
    : NextResponse.json({ error: "Scene generation job not found." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, jobId } = await params;
  const job = getSceneGenerationJob(jobId);
  if (!job || job.projectId !== id) return NextResponse.json({ error: "Scene generation job not found." }, { status: 404 });
  try {
    return NextResponse.json({ job: cancelSceneGenerationJob(jobId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Job could not be cancelled." }, { status: 409 });
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id, jobId } = await params;
  const job = getSceneGenerationJob(jobId);
  if (!job || job.projectId !== id) {
    return NextResponse.json({ error: "Scene generation job not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ job: restartSceneGenerationJob(jobId) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scene job could not be restarted." },
      { status: 409 }
    );
  }
}
