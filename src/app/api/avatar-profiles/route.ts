import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  addAvatarAsset,
  createAvatarProfile,
  deleteAvatarProfile,
  listAvatarProfiles,
  type AvatarAssetRole,
} from "@/lib/db/avatarProfiles";
import { deleteAvatarImages, storeAvatarImage } from "@/lib/videoMaker/avatarStorage";

export const dynamic = "force-dynamic";

const textSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultClothingDescription: z.string().trim().max(1_000).default(""),
  defaultStudioDescription: z.string().trim().max(2_000).default(""),
  defaultVisualStyle: z.string().trim().min(1).max(300).default("Realistic YouTube Presenter"),
  defaultVoiceProviderId: z.string().trim().max(120).nullable().optional(),
  defaultVoiceModelId: z.string().trim().max(200).nullable().optional(),
  language: z.string().trim().min(2).max(24).default("bn"),
  accent: z.string().trim().min(1).max(120).default("Bangla (Bangladesh)"),
  defaultCallToAction: z.string().trim().max(1_000).default(""),
});

const FILE_FIELDS: Array<{
  field: string;
  role: AvatarAssetRole;
  roleSlug: "front" | "left-angle" | "right-angle" | "full-body" | "channel-logo";
  required?: boolean;
}> = [
  { field: "frontImage", role: "FRONT", roleSlug: "front", required: true },
  { field: "leftAngleImage", role: "LEFT_ANGLE", roleSlug: "left-angle" },
  { field: "rightAngleImage", role: "RIGHT_ANGLE", roleSlug: "right-angle" },
  { field: "fullBodyImage", role: "FULL_BODY", roleSlug: "full-body" },
  { field: "channelLogo", role: "CHANNEL_LOGO", roleSlug: "channel-logo" },
];

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    return NextResponse.json({ profiles: listAvatarProfiles() });
  } catch (error) {
    console.error("[BijoyVideoMaker] Failed to list avatars:", error);
    return NextResponse.json({ error: "Failed to load avatar profiles." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "A multipart form upload is required." }, { status: 400 });
  }

  const parsed = textSchema.safeParse({
    name: formText(form, "name"),
    defaultClothingDescription: formText(form, "defaultClothingDescription"),
    defaultStudioDescription: formText(form, "defaultStudioDescription"),
    defaultVisualStyle: formText(form, "defaultVisualStyle") || undefined,
    defaultVoiceProviderId: formText(form, "defaultVoiceProviderId") || null,
    defaultVoiceModelId: formText(form, "defaultVoiceModelId") || null,
    language: formText(form, "language") || undefined,
    accent: formText(form, "accent") || undefined,
    defaultCallToAction: formText(form, "defaultCallToAction"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Avatar profile details are invalid.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const front = form.get("frontImage");
  if (!(front instanceof File) || front.size === 0) {
    return NextResponse.json({ error: "A front-facing reference image is required." }, { status: 400 });
  }

  let profileId: string | null = null;
  const storedKeys: string[] = [];
  try {
    const profile = createAvatarProfile(parsed.data);
    profileId = profile.id;

    for (const definition of FILE_FIELDS) {
      const value = form.get(definition.field);
      if (!(value instanceof File) || value.size === 0) {
        if (definition.required) throw new Error("A front-facing reference image is required.");
        continue;
      }
      const bytes = new Uint8Array(await value.arrayBuffer());
      const stored = await storeAvatarImage({
        profileId: profile.id,
        roleSlug: definition.roleSlug,
        originalFilename: value.name,
        declaredMimeType: value.type,
        bytes,
      });
      storedKeys.push(stored.storageKey);
      addAvatarAsset({
        avatarProfileId: profile.id,
        assetRole: definition.role,
        storageKey: stored.storageKey,
        originalFilename: stored.originalFilename,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
        sha256: stored.sha256,
      });
    }

    const created = listAvatarProfiles().find((item) => item.id === profile.id) ?? profile;
    return NextResponse.json({ profile: created }, { status: 201 });
  } catch (error) {
    if (profileId) deleteAvatarProfile(profileId);
    await deleteAvatarImages(storedKeys).catch(() => undefined);
    console.error("[BijoyVideoMaker] Avatar upload failed:", error);
    const message = error instanceof Error ? error.message : "Avatar profile could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
