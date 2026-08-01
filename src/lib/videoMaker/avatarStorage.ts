import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/db/core";

const MAX_AVATAR_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 16_384;
const AVATAR_STORAGE_ROOT = path.resolve(DATA_DIR, "bijoy-video-maker", "avatars");

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export interface StoredAvatarImage {
  storageKey: string;
  absolutePath: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
}

function isPng(data: Uint8Array): boolean {
  return (
    data.length >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  );
}

function isJpeg(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9;
}

function isWebp(data: Uint8Array): boolean {
  return (
    data.length >= 30 &&
    Buffer.from(data.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(data.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

function pngDimensions(data: Uint8Array): { width: number; height: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(data: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > data.length) break;
    const length = (data[offset + 2] << 8) | data[offset + 3];
    if (length < 2 || offset + length + 2 > data.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 9 < data.length) {
      return {
        height: (data[offset + 5] << 8) | data[offset + 6],
        width: (data[offset + 7] << 8) | data[offset + 8],
      };
    }
    offset += length + 2;
  }
  throw new Error("JPEG dimensions could not be read.");
}

function webpDimensions(data: Uint8Array): { width: number; height: number } {
  const type = Buffer.from(data.subarray(12, 16)).toString("ascii");
  if (type === "VP8X" && data.length >= 30) {
    const width = 1 + data[24] + (data[25] << 8) + (data[26] << 16);
    const height = 1 + data[27] + (data[28] << 8) + (data[29] << 16);
    return { width, height };
  }
  if (type === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
    const bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (type === "VP8 " && data.length >= 30) {
    const start = Buffer.from(data).indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (start >= 0 && start + 7 <= data.length) {
      return {
        width: (data[start + 3] | (data[start + 4] << 8)) & 0x3fff,
        height: (data[start + 5] | (data[start + 6] << 8)) & 0x3fff,
      };
    }
  }
  throw new Error("WebP dimensions could not be read.");
}

function inspectImage(data: Uint8Array, declaredMimeType: string): { mimeType: string; width: number; height: number } {
  let mimeType: string;
  let dimensions: { width: number; height: number };
  if (isPng(data)) {
    mimeType = "image/png";
    dimensions = pngDimensions(data);
  } else if (isJpeg(data)) {
    mimeType = "image/jpeg";
    dimensions = jpegDimensions(data);
  } else if (isWebp(data)) {
    mimeType = "image/webp";
    dimensions = webpDimensions(data);
  } else {
    throw new Error("Only valid PNG, JPEG and WebP images are accepted.");
  }
  if (declaredMimeType && declaredMimeType !== mimeType) {
    throw new Error("The image file content does not match its declared MIME type.");
  }
  if (
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < 64 ||
    dimensions.height < 64 ||
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error("Image dimensions are invalid or outside the accepted range.");
  }
  return { mimeType, ...dimensions };
}

function resolveStorageKey(storageKey: string): string {
  if (!/^[a-f0-9-]+\/(front|left-angle|right-angle|full-body|channel-logo)-[a-f0-9-]+\.(jpg|png|webp)$/.test(storageKey)) {
    throw new Error("Invalid avatar storage key.");
  }
  const resolved = path.resolve(AVATAR_STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(`${AVATAR_STORAGE_ROOT}${path.sep}`)) {
    throw new Error("Avatar path traversal was rejected.");
  }
  return resolved;
}

export async function storeAvatarImage(input: {
  profileId: string;
  roleSlug: "front" | "left-angle" | "right-angle" | "full-body" | "channel-logo";
  originalFilename: string;
  declaredMimeType: string;
  bytes: Uint8Array;
}): Promise<StoredAvatarImage> {
  if (input.bytes.byteLength < 64 || input.bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error(`Image must be between 64 bytes and ${MAX_AVATAR_BYTES} bytes.`);
  }
  if (!/^[a-f0-9-]{36}$/i.test(input.profileId)) {
    throw new Error("Invalid avatar profile identifier.");
  }
  const inspected = inspectImage(input.bytes, input.declaredMimeType);
  const extension = MIME_EXTENSION[inspected.mimeType];
  const storageKey = `${input.profileId}/${input.roleSlug}-${randomUUID()}${extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes, { flag: "wx", mode: 0o600 });
  return {
    storageKey,
    absolutePath,
    originalFilename: path.basename(input.originalFilename).slice(0, 255) || `avatar${extension}`,
    mimeType: inspected.mimeType,
    byteSize: input.bytes.byteLength,
    width: inspected.width,
    height: inspected.height,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function readAvatarImage(storageKey: string): Promise<Buffer> {
  return readFile(resolveStorageKey(storageKey));
}

export async function deleteAvatarImage(storageKey: string): Promise<void> {
  await rm(resolveStorageKey(storageKey), { force: true });
}

export async function deleteAvatarImages(storageKeys: string[]): Promise<void> {
  await Promise.all(storageKeys.map((storageKey) => deleteAvatarImage(storageKey)));
}
