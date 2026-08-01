import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { planVideoProject } from "@/lib/videoMaker/projectPlanning";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  try {
    const result = await planVideoProject(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[BijoyVideoMaker] Project planning failed:", error);
    const message = error instanceof Error ? error.message : "Video planning failed.";
    const status = message === "Video project not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
