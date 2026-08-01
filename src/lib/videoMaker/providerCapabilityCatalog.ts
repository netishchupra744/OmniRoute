import { VIDEO_PROVIDERS } from "@omniroute/open-sse/config/videoRegistry.ts";
import type { VideoModelCapabilities } from "@/domain/videoMaker/types";
import {
  evaluateVideoModelCompatibility,
  filterCompatibleVideoModels,
} from "@/domain/videoMaker/providerCapabilities";
import type { VideoGenerationRequirements } from "@/domain/videoMaker/types";

export interface VideoCapabilityCatalogEntry extends VideoModelCapabilities {
  providerDisplayName: string;
  providerAuthType: string;
  evidence: string[];
  verified: boolean;
}

const LOCAL_PROVIDER_IDS = new Set(["comfyui", "sdwebui"]);
const DASH_SCOPE_PROVIDER_IDS = new Set([
  "alibaba",
  "qwen-cloud",
  "qwen-cloud-token-plan",
  "bailian-coding-plan",
]);

function isImageModel(modelId: string): boolean {
  return /(^|[\/_-])(i2v|image-to-video|image_to_video|ref)([\/_-]|$)/i.test(modelId);
}

function isReferenceModel(modelId: string): boolean {
  return isImageModel(modelId) || /(^|[\/_-])r2v([\/_-]|$)/i.test(modelId);
}

function isTextModel(modelId: string): boolean {
  return !/(videoedit|video-edit|image-to-video|image_to_video|(^|[\/_-])i2v([\/_-]|$)|(^|[\/_-])r2v([\/_-]|$)|-ref$)/i.test(
    modelId
  );
}

function providerName(providerId: string): string {
  return providerId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildEntry(
  providerId: string,
  provider: (typeof VIDEO_PROVIDERS)[string],
  model: (typeof provider.models)[number]
): VideoCapabilityCatalogEntry {
  const localOnly =
    LOCAL_PROVIDER_IDS.has(providerId) ||
    provider.baseUrl.startsWith("http://localhost") ||
    provider.baseUrl.startsWith("http://127.0.0.1");
  const evidence: string[] = ["model-present-in-videoRegistry"];

  const runway = providerId === "runwayml";
  const dashscope = DASH_SCOPE_PROVIDER_IDS.has(providerId);
  const googleFlow = providerId === "googleflow";
  const novita = providerId === "novita";
  const adobe = providerId === "adobe-firefly";
  const supportsImageToVideo = isImageModel(model.id) || runway;
  const supportsReferenceImage = isReferenceModel(model.id) || runway;
  const supportsTextToVideo = isTextModel(model.id) || runway;

  if (supportsImageToVideo) evidence.push("handler-or-model-id-accepts-image-input");
  if (supportsReferenceImage) evidence.push("handler-or-model-id-accepts-reference-input");
  if (runway) evidence.push("runway-handler-clamps-duration-to-maximum-10-seconds");
  if (dashscope) evidence.push("dashscope-handler-forwards-duration-and-ratio");
  if (googleFlow) evidence.push("google-flow-helper-forwards-duration-and-ratio-unverified-wire");
  if (novita) evidence.push("novita-handler-forwards-duration-and-dimensions");
  if (adobe) evidence.push("adobe-handler-forwards-generateAudio");
  if (provider.statusUrl) evidence.push("registry-has-provider-status-url");
  if (localOnly) evidence.push("local-provider-disabled-in-bijoy-user-ui");

  return {
    providerId,
    modelId: model.id,
    displayName: model.name,
    providerDisplayName: providerName(providerId),
    providerAuthType: provider.authType,
    supportsTextToVideo,
    supportsImageToVideo,
    supportsReferenceImage,
    supportsNativeAudio: adobe,
    supportsBanglaVoice: false,
    supportsLipSync: false,
    supportsTenSecondDuration: runway,
    supportsSixteenByNine: runway || dashscope || googleFlow || novita || adobe,
    supports1080p: false,
    supportsSeed: runway,
    supportsAsyncJobs: Boolean(provider.statusUrl) || runway || googleFlow || adobe,
    supportsFinalRendering: false,
    maximumDuration: runway ? 10 : null,
    supportedAspectRatios:
      runway || dashscope || googleFlow || novita || adobe ? ["16:9", "9:16"] : [],
    estimatedCost: null,
    rateLimitCategory: model.isMarket ? "marketplace-paid" : "provider-defined",
    localOnly,
    evidence,
    // `verified` means every Bijoy-critical capability is proven in checked-in source.
    // It deliberately remains false until provider-specific contract tests confirm
    // reference identity, exact 10 s, 1080p, Bangla audio and lip-sync together.
    verified: false,
  };
}

export function getVideoCapabilityCatalog(options: {
  includeLocal?: boolean;
} = {}): VideoCapabilityCatalogEntry[] {
  return Object.entries(VIDEO_PROVIDERS)
    .flatMap(([providerId, provider]) =>
      provider.models.map((model) => buildEntry(providerId, provider, model))
    )
    .filter((entry) => options.includeLocal || !entry.localOnly)
    .sort((a, b) =>
      a.providerDisplayName.localeCompare(b.providerDisplayName) ||
      a.displayName.localeCompare(b.displayName)
    );
}

export function getCompatibleVideoCapabilityCatalog(
  requirements: VideoGenerationRequirements
): VideoCapabilityCatalogEntry[] {
  const catalog = getVideoCapabilityCatalog();
  const compatible = new Set(
    filterCompatibleVideoModels(catalog, requirements).map(
      (model) => `${model.providerId}/${model.modelId}`
    )
  );
  return catalog.filter((entry) => compatible.has(`${entry.providerId}/${entry.modelId}`));
}

export function getVideoCapabilityReport(requirements: VideoGenerationRequirements): Array<{
  model: VideoCapabilityCatalogEntry;
  compatible: boolean;
  reasons: string[];
}> {
  return getVideoCapabilityCatalog().map((model) => {
    const evaluation = evaluateVideoModelCompatibility(model, requirements);
    return { model, compatible: evaluation.compatible, reasons: evaluation.reasons };
  });
}
