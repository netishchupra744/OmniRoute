export const VIDEO_PROJECT_STATUSES = [
  "DRAFT",
  "PLANNING",
  "PLAN_READY",
  "GENERATING",
  "PARTIALLY_COMPLETED",
  "READY_TO_RENDER",
  "RENDERING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type VideoProjectStatus = (typeof VIDEO_PROJECT_STATUSES)[number];

export const SCENE_STATUSES = [
  "DRAFT",
  "PROMPT_READY",
  "QUEUED",
  "SUBMITTING",
  "PROCESSING",
  "DOWNLOADING",
  "COMPLETED",
  "RETRYING",
  "FAILED",
  "CANCELLED",
] as const;

export type SceneStatus = (typeof SCENE_STATUSES)[number];

export interface ScenePlan {
  sceneNumber: number;
  title: string;
  purpose: string;
  durationSeconds: number;
  exactDialogue: string;
  presenterAction: string;
  visualDescription: string;
  backgroundDescription: string;
  screenContent: string;
  cameraShot: string;
  cameraMovement: string;
  lighting: string;
  textOverlays: string[];
  soundEffects: string;
  musicDirection: string;
  transitionIn: string;
  transitionOut: string;
  previousSceneContinuity: string;
  nextSceneContinuity: string;
  negativeConstraints: string[];
}

export interface ScenePlanValidationOptions {
  expectedSceneCount?: number;
  expectedDurationSeconds?: number;
  maximumDialogueWords?: number;
  requireStoryBeats?: boolean;
}

export interface ScenePlanValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalDurationSeconds: number;
}

export interface MasterPromptIdentityRules {
  videoObjective: string;
  targetAudience: string;
  presenterIdentity: string;
  referenceImageRules: string;
  faceConsistency: string;
  hairstyle: string;
  beard: string;
  skinTone: string;
  bodyProportions: string;
  clothing: string;
  studio: string;
  lighting: string;
  cameraLanguage: string;
  movementRules: string;
  voiceRequirements: string;
  lipSyncRequirements: string;
  musicStyle: string;
  soundEffectStyle: string;
  textOverlayRules: string;
  sceneContinuity: string;
  negativeConstraints: string[];
}

export interface AvatarPromptProfile {
  avatarName: string;
  referenceAssetIds: string[];
  clothingDescription?: string;
  studioDescription?: string;
  visualStyle?: string;
  language: string;
  accent: string;
  defaultCallToAction?: string;
}

export interface ProjectPromptSettings {
  aspectRatio: string;
  width: number;
  height: number;
  durationSeconds: number;
  nativeAudioMode: boolean;
}

export interface CompileScenePromptInput {
  master: MasterPromptIdentityRules;
  avatar: AvatarPromptProfile;
  settings: ProjectPromptSettings;
  scene: ScenePlan;
}

export interface VideoModelCapabilities {
  providerId: string;
  modelId: string;
  displayName: string;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsReferenceImage: boolean;
  supportsNativeAudio: boolean;
  supportsBanglaVoice: boolean;
  supportsLipSync: boolean;
  supportsTenSecondDuration: boolean;
  supportsSixteenByNine: boolean;
  supports1080p: boolean;
  supportsSeed: boolean;
  supportsAsyncJobs: boolean;
  supportsFinalRendering: boolean;
  maximumDuration: number | null;
  supportedAspectRatios: string[];
  estimatedCost: number | null;
  rateLimitCategory: string;
  localOnly?: boolean;
}

export interface VideoGenerationRequirements {
  mode: "native-video-audio" | "separate-api-voice";
  requiresReferenceImage: boolean;
  requiresBanglaVoice: boolean;
  requiresLipSync: boolean;
  durationSeconds: number;
  aspectRatio: string;
  width: number;
  height: number;
  requiresAsyncJobs?: boolean;
  finalRendering?: boolean;
}

export type RetryErrorKind =
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "PROVIDER_5XX"
  | "AUTHENTICATION"
  | "VALIDATION"
  | "UNSUPPORTED_CAPABILITY"
  | "QUOTA_EXHAUSTED"
  | "CANCELLED"
  | "UNKNOWN";

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  useFallbackProvider: boolean;
  reason: string;
}
