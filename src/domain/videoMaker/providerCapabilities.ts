import type {
  VideoGenerationRequirements,
  VideoModelCapabilities,
} from "./types.ts";

export interface CapabilityFilterResult {
  compatible: boolean;
  reasons: string[];
}

export function evaluateVideoModelCompatibility(
  model: VideoModelCapabilities,
  requirements: VideoGenerationRequirements
): CapabilityFilterResult {
  const reasons: string[] = [];

  if (model.localOnly) reasons.push("Local-only providers are disabled in Bijoy AI Video Maker.");
  if (requirements.finalRendering) {
    if (!model.supportsFinalRendering) reasons.push("Model does not support final rendering.");
    return { compatible: reasons.length === 0, reasons };
  }

  if (!model.supportsTextToVideo && !model.supportsImageToVideo) {
    reasons.push("Model does not support video generation.");
  }
  if (requirements.requiresReferenceImage && !model.supportsReferenceImage) {
    reasons.push("Model does not support reference images.");
  }
  if (requirements.mode === "native-video-audio" && !model.supportsNativeAudio) {
    reasons.push("Model does not support native video audio.");
  }
  if (requirements.requiresBanglaVoice && !model.supportsBanglaVoice) {
    reasons.push("Model does not declare Bangla voice support.");
  }
  if (requirements.requiresLipSync && !model.supportsLipSync) {
    reasons.push("Model does not declare lip-sync support.");
  }
  if (requirements.durationSeconds === 10 && !model.supportsTenSecondDuration) {
    reasons.push("Model does not support an exact 10-second request.");
  }
  if (
    model.maximumDuration !== null &&
    requirements.durationSeconds > model.maximumDuration
  ) {
    reasons.push(`Requested duration exceeds maximumDuration=${model.maximumDuration}.`);
  }
  if (
    requirements.aspectRatio === "16:9" &&
    (!model.supportsSixteenByNine || !model.supportedAspectRatios.includes("16:9"))
  ) {
    reasons.push("Model does not support 16:9 output.");
  }
  if (
    requirements.width >= 1920 &&
    requirements.height >= 1080 &&
    !model.supports1080p
  ) {
    reasons.push("Model does not support 1920×1080 output.");
  }
  if (requirements.requiresAsyncJobs && !model.supportsAsyncJobs) {
    reasons.push("Model does not support persistent asynchronous jobs.");
  }

  return { compatible: reasons.length === 0, reasons };
}

export function filterCompatibleVideoModels(
  models: VideoModelCapabilities[],
  requirements: VideoGenerationRequirements
): VideoModelCapabilities[] {
  return models.filter(
    (model) => evaluateVideoModelCompatibility(model, requirements).compatible
  );
}
