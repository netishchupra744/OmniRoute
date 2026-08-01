import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  deleteAvatarProfile,
  getAvatarProfile,
  listAvatarStorageKeys,
} from "@/lib/db/avatarProfiles";
import { deleteAvatarImages } from "@/lib/videoMaker/avatarStorage";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const profile = getAvatarProfile(id);
  return profile
    ? NextResponse.json({ profile })
    : NextResponse.json({ error: "Avatar profile not found." }, { status: 404 });
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const storageKeys = listAvatarStorageKeys(id);
  if (!deleteAvatarProfile(id)) {
    return NextResponse.json({ error: "Avatar profile not found." }, { status: 404 });
  }
  await deleteAvatarImages(storageKeys).catch((error) => {
    console.warn("[BijoyVideoMaker] Orphan avatar file cleanup failed:", error);
  });
  return NextResponse.json({ deleted: true });
}
