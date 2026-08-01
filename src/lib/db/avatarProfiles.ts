import { randomUUID } from "node:crypto";
import { getDbInstance, rowToCamel } from "./core";

export const AVATAR_ASSET_ROLES = [
  "FRONT",
  "LEFT_ANGLE",
  "RIGHT_ANGLE",
  "FULL_BODY",
  "CHANNEL_LOGO",
] as const;
export type AvatarAssetRole = (typeof AVATAR_ASSET_ROLES)[number];

export interface CreateAvatarProfileInput {
  name: string;
  defaultClothingDescription?: string;
  defaultStudioDescription?: string;
  defaultVisualStyle?: string;
  defaultVoiceProviderId?: string | null;
  defaultVoiceModelId?: string | null;
  language?: string;
  accent?: string;
  defaultCallToAction?: string;
}

export interface AvatarAssetRecord {
  id: string;
  avatarProfileId: string;
  assetRole: AvatarAssetRole;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
}

export interface AvatarProfileRecord {
  id: string;
  name: string;
  defaultClothingDescription: string;
  defaultStudioDescription: string;
  defaultVisualStyle: string;
  defaultVoiceProviderId: string | null;
  defaultVoiceModelId: string | null;
  language: string;
  accent: string;
  channelLogoAssetId: string | null;
  defaultCallToAction: string;
  createdAt: string;
  updatedAt: string;
  assets: AvatarAssetRecord[];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapAsset(row: unknown): AvatarAssetRecord | null {
  const mapped = rowToCamel(row) as Record<string, unknown> | null;
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    avatarProfileId: String(mapped.avatarProfileId),
    assetRole: mapped.assetRole as AvatarAssetRole,
    storageKey: String(mapped.storageKey),
    originalFilename: String(mapped.originalFilename),
    mimeType: String(mapped.mimeType),
    byteSize: Number(mapped.byteSize),
    width: Number(mapped.width),
    height: Number(mapped.height),
    sha256: String(mapped.sha256),
    createdAt: String(mapped.createdAt),
  };
}

function mapProfile(row: unknown, assets: AvatarAssetRecord[] = []): AvatarProfileRecord | null {
  const mapped = rowToCamel(row) as Record<string, unknown> | null;
  if (!mapped) return null;
  return {
    id: String(mapped.id),
    name: String(mapped.name),
    defaultClothingDescription: String(mapped.defaultClothingDescription ?? ""),
    defaultStudioDescription: String(mapped.defaultStudioDescription ?? ""),
    defaultVisualStyle: String(mapped.defaultVisualStyle),
    defaultVoiceProviderId: stringOrNull(mapped.defaultVoiceProviderId),
    defaultVoiceModelId: stringOrNull(mapped.defaultVoiceModelId),
    language: String(mapped.language),
    accent: String(mapped.accent),
    channelLogoAssetId: stringOrNull(mapped.channelLogoAssetId),
    defaultCallToAction: String(mapped.defaultCallToAction ?? ""),
    createdAt: String(mapped.createdAt),
    updatedAt: String(mapped.updatedAt),
    assets,
  };
}

export function createAvatarProfile(input: CreateAvatarProfileInput): AvatarProfileRecord {
  const name = input.name.trim();
  if (!name) throw new Error("Avatar name is required.");
  const id = randomUUID();
  const db = getDbInstance();
  db.prepare(
    `INSERT INTO avatar_profiles (
      id, name, default_clothing_description, default_studio_description,
      default_visual_style, default_voice_provider_id, default_voice_model_id,
      language, accent, default_call_to_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    input.defaultClothingDescription?.trim() ?? "",
    input.defaultStudioDescription?.trim() ?? "",
    input.defaultVisualStyle?.trim() || "Realistic YouTube Presenter",
    input.defaultVoiceProviderId ?? null,
    input.defaultVoiceModelId ?? null,
    input.language?.trim() || "bn",
    input.accent?.trim() || "Bangla (Bangladesh)",
    input.defaultCallToAction?.trim() ?? ""
  );
  const created = getAvatarProfile(id);
  if (!created) throw new Error("Avatar profile was not persisted.");
  return created;
}

export function addAvatarAsset(input: Omit<AvatarAssetRecord, "id" | "createdAt">): AvatarAssetRecord {
  if (!AVATAR_ASSET_ROLES.includes(input.assetRole)) {
    throw new Error(`Unsupported avatar asset role: ${input.assetRole}`);
  }
  const id = randomUUID();
  const db = getDbInstance();
  db.prepare(
    `INSERT INTO avatar_assets (
      id, avatar_profile_id, asset_role, storage_key, original_filename,
      mime_type, byte_size, width, height, sha256
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(avatar_profile_id, asset_role) DO UPDATE SET
      id = excluded.id,
      storage_key = excluded.storage_key,
      original_filename = excluded.original_filename,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      width = excluded.width,
      height = excluded.height,
      sha256 = excluded.sha256,
      created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  ).run(
    id,
    input.avatarProfileId,
    input.assetRole,
    input.storageKey,
    input.originalFilename,
    input.mimeType,
    input.byteSize,
    input.width,
    input.height,
    input.sha256
  );
  const row = db.prepare("SELECT * FROM avatar_assets WHERE id = ?").get(id);
  const asset = mapAsset(row);
  if (!asset) throw new Error("Avatar asset was not persisted.");
  if (input.assetRole === "CHANNEL_LOGO") {
    db.prepare(
      `UPDATE avatar_profiles
       SET channel_logo_asset_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(id, input.avatarProfileId);
  }
  return asset;
}

export function listAvatarProfiles(): AvatarProfileRecord[] {
  const db = getDbInstance();
  const profiles = db.prepare("SELECT * FROM avatar_profiles ORDER BY updated_at DESC").all();
  return profiles
    .map((row) => {
      const base = mapProfile(row);
      return base ? getAvatarProfile(base.id) : null;
    })
    .filter((profile): profile is AvatarProfileRecord => profile !== null);
}

export function getAvatarProfile(profileId: string): AvatarProfileRecord | null {
  const db = getDbInstance();
  const assets = db
    .prepare("SELECT * FROM avatar_assets WHERE avatar_profile_id = ? ORDER BY created_at")
    .all(profileId)
    .map(mapAsset)
    .filter((asset): asset is AvatarAssetRecord => asset !== null);
  return mapProfile(db.prepare("SELECT * FROM avatar_profiles WHERE id = ?").get(profileId), assets);
}

export function getAvatarAsset(assetId: string): AvatarAssetRecord | null {
  return mapAsset(getDbInstance().prepare("SELECT * FROM avatar_assets WHERE id = ?").get(assetId));
}

export function listAvatarStorageKeys(profileId: string): string[] {
  return getDbInstance()
    .prepare("SELECT storage_key FROM avatar_assets WHERE avatar_profile_id = ?")
    .all(profileId)
    .map((row) => (row as Record<string, unknown>).storage_key)
    .filter((value): value is string => typeof value === "string");
}

export function deleteAvatarProfile(profileId: string): boolean {
  return getDbInstance().prepare("DELETE FROM avatar_profiles WHERE id = ?").run(profileId).changes > 0;
}
