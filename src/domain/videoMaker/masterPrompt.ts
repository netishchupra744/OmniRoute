import type { MasterPromptIdentityRules } from "./types.ts";

const STRING_FIELDS = [
  "videoObjective",
  "targetAudience",
  "presenterIdentity",
  "referenceImageRules",
  "faceConsistency",
  "hairstyle",
  "beard",
  "skinTone",
  "bodyProportions",
  "clothing",
  "studio",
  "lighting",
  "cameraLanguage",
  "movementRules",
  "voiceRequirements",
  "lipSyncRequirements",
  "musicStyle",
  "soundEffectStyle",
  "textOverlayRules",
  "sceneContinuity",
] as const;

export interface MasterPromptValidationResult {
  ok: boolean;
  errors: string[];
  value: MasterPromptIdentityRules | null;
}

export function validateMasterPromptIdentityRules(
  input: unknown
): MasterPromptValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Master prompt must be a JSON object."], value: null };
  }
  const record = input as Record<string, unknown>;
  for (const field of STRING_FIELDS) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }
  if (
    !Array.isArray(record.negativeConstraints) ||
    record.negativeConstraints.length === 0 ||
    record.negativeConstraints.some((item) => typeof item !== "string" || !item.trim())
  ) {
    errors.push("negativeConstraints must be a non-empty array of non-empty strings.");
  }
  return {
    ok: errors.length === 0,
    errors,
    value: errors.length === 0 ? (record as unknown as MasterPromptIdentityRules) : null,
  };
}

export function formatMasterPrompt(rules: MasterPromptIdentityRules): string {
  const labels: Record<(typeof STRING_FIELDS)[number], string> = {
    videoObjective: "Video objective",
    targetAudience: "Target audience",
    presenterIdentity: "Presenter identity",
    referenceImageRules: "Reference-image rules",
    faceConsistency: "Face consistency",
    hairstyle: "Hairstyle",
    beard: "Beard",
    skinTone: "Skin tone",
    bodyProportions: "Body proportions",
    clothing: "Clothing",
    studio: "Studio",
    lighting: "Lighting",
    cameraLanguage: "Camera language",
    movementRules: "Natural movement",
    voiceRequirements: "Bangla voice requirements",
    lipSyncRequirements: "Lip-sync requirements",
    musicStyle: "Music style",
    soundEffectStyle: "Sound-effect style",
    textOverlayRules: "Text-overlay rules",
    sceneContinuity: "Scene continuity",
  };
  return [
    "BIJOY AI VIDEO MAKER — PROJECT MASTER PROMPT",
    "",
    ...STRING_FIELDS.flatMap((field) => [labels[field].toUpperCase(), rules[field].trim(), ""]),
    "NEGATIVE CONSTRAINTS",
    ...rules.negativeConstraints.map((constraint) => `- ${constraint.trim()}`),
    "",
    "GLOBAL OUTPUT CONTRACT",
    "- Exactly 33 connected scenes.",
    "- Every scene is exactly 10.0 seconds.",
    "- Total project duration is exactly 330 seconds (5 minutes 30 seconds).",
    "- Aspect ratio 16:9; target resolution 1920×1080.",
    "- No extra dialogue, premature ending, random text, fake interface text, robotic movement or distorted anatomy.",
  ].join("\n");
}

export function buildMasterPromptRepairInstruction(errors: string[]): string {
  return [
    "Repair the master-prompt JSON and return JSON only.",
    "Do not return markdown fences or commentary.",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
  ].join("\n");
}
