export interface SceneRecord {
  id: string;
  sceneNumber: number;
  title: string;
  purpose: string;
  exactDialogue: string;
  durationSeconds: number;
  status: string;
  locked: boolean;
  currentPromptText: string | null;
  promptVersion?: number | null;
  lastErrorMessage?: string | null;
}

export interface ProjectRecord {
  id: string;
  name: string;
  videoTitle: string;
  status: string;
  lastErrorMessage: string | null;
  finalOutputUrl?: string | null;
  finalDurationSeconds?: number | null;
  settings?: {
    sceneCount: number;
    sceneDurationSeconds: number;
    width: number;
    height: number;
    aspectRatio: string;
    audioMode?: "NATIVE_VIDEO_AUDIO" | "SEPARATE_API_VOICE";
    videoProviderId?: string | null;
    videoModelId?: string | null;
    renderProviderId?: string | null;
    renderModelId?: string | null;
  } | null;
}

export interface MasterRecord {
  id?: string;
  promptText: string;
  version: number;
}

export interface SceneJobRecord {
  id: string;
  sceneId: string;
  sceneNumber: number;
  providerId: string;
  modelId: string;
  status: string;
  attemptCount: number;
  maximumAttempts: number;
  statusMessage: string | null;
  errorMessage: string | null;
  outputUrl: string | null;
  outputDurationSeconds: number | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
}

export interface VideoModelOption {
  providerId: string;
  modelId: string;
  displayName: string;
  providerDisplayName: string;
  estimatedCost: number | null;
  verified: boolean;
}
