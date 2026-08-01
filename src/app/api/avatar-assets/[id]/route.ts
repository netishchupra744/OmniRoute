import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAvatarAsset } from "@/lib/db/avatarProfiles";
import { readAvatarImage } from "@/lib/videoMaker/avatarStorage";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const asset = getAvatarAsset(id);
  if (!asset) return NextResponse.json({ error: "Avatar image not found." }, { status: 404 });
  try {
    const content = await readAvatarImage(asset.storageKey);
    return new Response(content, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(content.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("[BijoyVideoMaker] Avatar asset read failed:", error);
    return NextResponse.json({ error: "Avatar image is unavailable." }, { status: 404 });
  }
}
