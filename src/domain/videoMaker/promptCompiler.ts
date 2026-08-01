import type { CompileScenePromptInput } from "./types.ts";

function list(values: string[]): string {
  return values.map((value) => `- ${value.trim()}`).join("\n");
}

function line(label: string, value: string | undefined): string {
  return `${label}: ${value?.trim() || "Not specified"}`;
}

export function compileScenePrompt(input: CompileScenePromptInput): string {
  const { master, avatar, settings, scene } = input;
  if (scene.durationSeconds !== settings.durationSeconds) {
    throw new Error(
      `Scene duration (${scene.durationSeconds}) does not match project duration (${settings.durationSeconds}).`
    );
  }
  if (!avatar.referenceAssetIds.length) {
    throw new Error("At least one avatar reference asset is required.");
  }

  const mode = settings.nativeAudioMode
    ? "Generate native synchronized voice and video audio in the same provider job."
    : "Generate the visual performance for synchronization with a separate API voice/lip-sync workflow.";

  return [
    `BIJOY AI VIDEO MAKER — SELF-CONTAINED SCENE ${scene.sceneNumber}`,
    "",
    "NON-NEGOTIABLE OUTPUT CONTRACT",
    `- Generate exactly ${settings.durationSeconds}.0 seconds. Do not end early and do not add a tail frame.`,
    `- Aspect ratio: ${settings.aspectRatio}. Resolution: ${settings.width}×${settings.height}.`,
    `- ${mode}`,
    "- Use only the exact dialogue below. No extra dialogue, narration, filler words, captions, or invented speech.",
    "- Preserve the same presenter identity and reference-image appearance throughout this scene.",
    "",
    "PROJECT INTENT",
    line("Video objective", master.videoObjective),
    line("Target audience", master.targetAudience),
    "",
    "PRESENTER AND AVATAR IDENTITY",
    line("Avatar profile", avatar.avatarName),
    line("Reference asset IDs", avatar.referenceAssetIds.join(", ")),
    line("Presenter identity", master.presenterIdentity),
    line("Reference-image rules", master.referenceImageRules),
    line("Face consistency", master.faceConsistency),
    line("Hairstyle", master.hairstyle),
    line("Beard", master.beard),
    line("Skin tone", master.skinTone),
    line("Body proportions", master.bodyProportions),
    line("Clothing", avatar.clothingDescription || master.clothing),
    line("Language", avatar.language),
    line("Accent", avatar.accent),
    "",
    "GLOBAL VISUAL AND PERFORMANCE RULES",
    line("Visual style", avatar.visualStyle),
    line("Studio", avatar.studioDescription || master.studio),
    line("Lighting language", master.lighting),
    line("Camera language", master.cameraLanguage),
    line("Natural movement", master.movementRules),
    line("Voice", master.voiceRequirements),
    line("Lip sync", master.lipSyncRequirements),
    line("Text overlay rules", master.textOverlayRules),
    line("Continuity rules", master.sceneContinuity),
    "",
    "CURRENT SCENE",
    line("Scene title", scene.title),
    line("Scene purpose", scene.purpose),
    line("Exact dialogue", scene.exactDialogue),
    line("Presenter action", scene.presenterAction),
    line("Visual description", scene.visualDescription),
    line("Background", scene.backgroundDescription),
    line("Screen content", scene.screenContent),
    line("Camera shot", scene.cameraShot),
    line("Camera movement", scene.cameraMovement),
    line("Scene lighting", scene.lighting),
    line("Text overlays", scene.textOverlays.length ? scene.textOverlays.join(" | ") : "None"),
    line("Sound effects", scene.soundEffects || master.soundEffectStyle),
    line("Music direction", scene.musicDirection || master.musicStyle),
    line("Transition in", scene.transitionIn),
    line("Transition out", scene.transitionOut),
    "",
    "CONTINUITY",
    line("Continue from previous scene", scene.previousSceneContinuity),
    line("Prepare next scene", scene.nextSceneContinuity),
    "",
    "NEGATIVE CONSTRAINTS",
    list([
      ...master.negativeConstraints,
      ...scene.negativeConstraints,
      "No robotic movement",
      "No distorted face, teeth, hands, fingers, anatomy, clothing, logo, or background objects",
      "No random text, fake interface text, watermarks, provider branding, or subtitles unless explicitly listed",
      "No identity drift, hairstyle drift, beard drift, skin-tone drift, body-proportion drift, or wardrobe drift",
      "No audio desynchronization, duplicate voice, echo, clipped dialogue, or premature ending",
    ]),
    "",
    `FINAL CHECK: Return one continuous ${settings.durationSeconds}.0-second ${settings.aspectRatio} scene at ${settings.width}×${settings.height}, using the exact presenter, exact dialogue, exact continuity, and no extra content.`,
  ].join("\n");
}
