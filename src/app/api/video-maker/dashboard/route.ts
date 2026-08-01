import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getVideoMakerDashboardStats } from "@/lib/db/videoProjects";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    return NextResponse.json(getVideoMakerDashboardStats());
  } catch (error) {
    console.error("[BijoyVideoMaker] Dashboard query failed:", error);
    return NextResponse.json({ error: "Failed to load dashboard data." }, { status: 500 });
  }
}
