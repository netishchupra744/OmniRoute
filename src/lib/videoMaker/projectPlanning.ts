import { compileScenePrompt } from "@/domain/videoMaker/promptCompiler";
import { formatMasterPrompt } from "@/domain/videoMaker/masterPrompt";
import { generateValidatedMasterPrompt } from "@/domain/videoMaker/masterPromptGenerator";
import { generateValidatedScenePlan } from "@/domain/videoMaker/scenePlanner";
import type { AvatarPromptProfile, MasterPromptIdentityRules, ScenePlan } from "@/domain/videoMaker/types";
import { getAvatarProfile } from "@/lib/db/avatarProfiles";
import {
  saveMasterPromptVersion,
  saveValidatedScenePlan,
  type MasterPromptVersionRecord,
  type ProjectSceneRecord,
} from "@/lib/db/videoProjectPlans";
import { getVideoProject, setVideoProjectStatus, type VideoProjectRecord } from "@/lib/db/videoProjects";
import { invokeInternalLlm } from "./internalLlm";

const MASTER_SCHEMA = `{
  "videoObjective": "string",
  "targetAudience": "string",
  "presenterIdentity": "string",
  "referenceImageRules": "string",
  "faceConsistency": "string",
  "hairstyle": "string",
  "beard": "string",
  "skinTone": "string",
  "bodyProportions": "string",
  "clothing": "string",
  "studio": "string",
  "lighting": "string",
  "cameraLanguage": "string",
  "movementRules": "string",
  "voiceRequirements": "string",
  "lipSyncRequirements": "string",
  "musicStyle": "string",
  "soundEffectStyle": "string",
  "textOverlayRules": "string",
  "sceneContinuity": "string",
  "negativeConstraints": ["string"]
}`;

const SCENE_SCHEMA = `[
  {
    "sceneNumber": 1,
    "title": "string",
    "purpose": "string",
    "durationSeconds": 10,
    "exactDialogue": "short Bangla dialogue",
    "presenterAction": "string",
    "visualDescription": "string",
    "backgroundDescription": "string",
    "screenContent": "string",
    "cameraShot": "string",
    "cameraMovement": "string",
    "lighting": "string",
    "textOverlays": ["string"],
    "soundEffects": "string",
    "musicDirection": "string",
    "transitionIn": "string",
    "transitionOut": "string",
    "previousSceneContinuity": "string",
    "nextSceneContinuity": "string",
    "negativeConstraints": ["string"]
  }
]`;

function buildMasterRequest(project: VideoProjectRecord, avatar: AvatarPromptProfile): string {
  return [
    "Create one reusable Master Prompt specification for a production YouTube presenter video.",
    "Return raw JSON only. Do not use markdown fences or commentary.",
    `Video title: ${project.videoTitle}`,
    `Language: ${project.settings?.language || "bn"}`,
    `Video type: ${project.settings?.videoType || "YOUTUBE_TUTORIAL"}`,
    `Visual style: ${project.settings?.visualStyle || avatar.visualStyle || "Realistic YouTube Presenter"}`,
    `Presenter/avatar: ${avatar.avatarName}`,
    `Reference asset count: ${avatar.referenceAssetIds.length}`,
    `Default clothing: ${avatar.clothingDescription || "Preserve the avatar's clothing unless the project specifies otherwise."}`,
    `Default studio: ${avatar.studioDescription || "Premium dark navy technology studio with cinematic depth."}`,
    `Accent: ${avatar.accent}`,
    `Call to action: ${avatar.defaultCallToAction || "Like, comment and subscribe."}`,
    `Optional source material: ${project.settings?.sourceMaterial || "None supplied."}`,
    "The output must explicitly require the same face, hair, beard, skin tone, proportions and clothing across all scenes; natural blinking, breathing, eye focus, head and hand movement; Bangla voice and lip-sync; exact timing; 16:9; 1920x1080; no extra dialogue, random text, fake interface text, robotic movement, distorted anatomy or premature ending.",
    "Use this exact JSON shape and fill every field with a non-empty value:",
    MASTER_SCHEMA,
  ].join("\n\n");
}

function buildSceneRequest(project: VideoProjectRecord, masterPromptText: string): string {
  return [
    "Create exactly 33 connected scenes for the project below.",
    "Return a raw JSON array only. Do not use markdown fences or commentary.",
    `Video title: ${project.videoTitle}`,
    `Language: ${project.settings?.language || "bn"}`,
    `Video type: ${project.settings?.videoType || "YOUTUBE_TUTORIAL"}`,
    `Optional source material: ${project.settings?.sourceMaterial || "None supplied."}`,
    "Every scene must be exactly 10 seconds and the total must be exactly 330 seconds.",
    "Scene numbers must be 1 through 33 with no duplicates. Dialogue and purpose must not repeat.",
    "Use concise natural Bangla dialogue that comfortably fits within ten seconds.",
    "The full progression must include Hook, Result Preview, Learning Promise, Requirements, Main Tutorial, Troubleshooting, Summary, Call To Action and Outro.",
    "Preserve visual and narrative continuity between adjacent scenes.",
    "MASTER PROMPT:",
    masterPromptText,
    "Use this scene object shape for all 33 entries:",
    SCENE_SCHEMA,
  ].join("\n\n");
}

function avatarPromptProfile(profile: NonNullable<ReturnType<typeof getAvatarProfile>>): AvatarPromptProfile {
  return {
    avatarName: profile.name,
    referenceAssetIds: profile.assets
      .filter((asset) => asset.assetRole !== "CHANNEL_LOGO")
      .map((asset) => asset.id),
    clothingDescription: profile.defaultClothingDescription,
    studioDescription: profile.defaultStudioDescription,
    visualStyle: profile.defaultVisualStyle,
    language: profile.language,
    accent: profile.accent,
    defaultCallToAction: profile.defaultCallToAction,
  };
}

export interface PlanVideoProjectResult {
  project: VideoProjectRecord;
  masterPrompt: MasterPromptVersionRecord;
  scenes: ProjectSceneRecord[];
}

export async function planVideoProject(projectId: string): Promise<PlanVideoProjectResult> {
  const project = getVideoProject(projectId);
  if (!project) throw new Error("Video project not found.");
  if (!project.avatarProfileId) throw new Error("Select an Avatar Profile before creating the plan.");
  if (!project.settings?.llmModelId) throw new Error("Select a default LLM model before creating the plan.");
  const avatarRecord = getAvatarProfile(project.avatarProfileId);
  if (!avatarRecord) throw new Error("The selected Avatar Profile no longer exists.");
  const avatar = avatarPromptProfile(avatarRecord);
  if (avatar.referenceAssetIds.length === 0) {
    throw new Error("The selected Avatar Profile has no usable reference image.");
  }

  setVideoProjectStatus(projectId, "PLANNING");
  try {
    const masterRules: MasterPromptIdentityRules = await generateValidatedMasterPrompt({
      initialPrompt: buildMasterRequest(project, avatar),
      invokeLlm: (prompt) =>
        invokeInternalLlm({
          model: project.settings!.llmModelId!,
          messages: [
            {
              role: "system",
              content: "You are the strict planning engine for Bijoy AI Video Maker. Follow the requested JSON contract exactly.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.15,
          maxTokens: 12_000,
        }),
    });
    const masterPromptText = formatMasterPrompt(masterRules);
    const masterPrompt = saveMasterPromptVersion({
      projectId,
      promptText: masterPromptText,
      sourceModel: project.settings.llmModelId,
      validation: { valid: true, exactSceneCount: 33, exactSceneDurationSeconds: 10 },
    });

    const scenes: ScenePlan[] = await generateValidatedScenePlan({
      initialPrompt: buildSceneRequest(project, masterPromptText),
      invokeLlm: (prompt) =>
        invokeInternalLlm({
          model: project.settings!.llmModelId!,
          messages: [
            {
              role: "system",
              content: "You are the strict 33-scene planner for Bijoy AI Video Maker. Return only schema-valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.25,
          maxTokens: 32_000,
        }),
      validationOptions: {
        expectedSceneCount: 33,
        expectedDurationSeconds: 10,
        maximumDialogueWords: 28,
        requireStoryBeats: true,
      },
      maximumAttempts: 3,
    });

    const compiledPrompts = new Map<number, string>();
    for (const scene of scenes) {
      compiledPrompts.set(
        scene.sceneNumber,
        compileScenePrompt({
          master: masterRules,
          avatar,
          settings: {
            aspectRatio: project.settings.aspectRatio,
            width: project.settings.width,
            height: project.settings.height,
            durationSeconds: project.settings.sceneDurationSeconds,
            nativeAudioMode: project.settings.audioMode === "NATIVE_VIDEO_AUDIO",
          },
          scene,
        })
      );
    }

    const savedScenes = saveValidatedScenePlan({
      projectId,
      masterPromptId: masterPrompt.id,
      scenes,
      compiledPrompts,
      sourceModel: project.settings.llmModelId,
    });
    const updatedProject = getVideoProject(projectId);
    if (!updatedProject) throw new Error("Video project disappeared after planning.");
    return { project: updatedProject, masterPrompt, scenes: savedScenes };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video planning failed.";
    setVideoProjectStatus(projectId, "FAILED", { code: "PLANNING_FAILED", message });
    throw error;
  }
}
