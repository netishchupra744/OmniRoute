import type {
  AvatarPromptProfile,
  MasterPromptIdentityRules,
  ProjectPromptSettings,
  ScenePlan,
} from "../../../src/domain/videoMaker/types.ts";

const PURPOSES = [
  "Hook the viewer",
  "Result preview",
  "Learning promise",
  "Requirements overview",
  "Main tutorial step one",
  "Troubleshooting common issue",
  "Summary recap",
  "Call to action",
  "Outro ending",
];

export function makeScenePlan(count = 33): ScenePlan[] {
  return Array.from({ length: count }, (_, index) => {
    const sceneNumber = index + 1;
    return {
      sceneNumber,
      title: sceneNumber <= PURPOSES.length ? PURPOSES[index] : `Tutorial Step ${sceneNumber}`,
      purpose:
        sceneNumber <= PURPOSES.length
          ? `${PURPOSES[index]} for scene ${sceneNumber}`
          : `Explain unique tutorial detail ${sceneNumber}`,
      durationSeconds: 10,
      exactDialogue: `এটি ${sceneNumber} নম্বর দৃশ্যের সংক্ষিপ্ত ও একমাত্র বাংলা সংলাপ।`,
      presenterAction: `Presenter demonstrates action ${sceneNumber}`,
      visualDescription: `Unique visual description ${sceneNumber}`,
      backgroundDescription: "Premium dark navy technology studio",
      screenContent: `Relevant screen content ${sceneNumber}`,
      cameraShot: "Medium shot",
      cameraMovement: "Slow controlled push-in",
      lighting: "Cinematic cyan and purple rim lighting",
      textOverlays: [`STEP ${sceneNumber}`],
      soundEffects: "Subtle interface click",
      musicDirection: "Low energetic electronic underscore",
      transitionIn: sceneNumber === 1 ? "Fade from black" : `Continue from scene ${sceneNumber - 1}`,
      transitionOut: sceneNumber === count ? "Fade to black" : `Lead into scene ${sceneNumber + 1}`,
      previousSceneContinuity:
        sceneNumber === 1
          ? "Open the project with the same presenter identity"
          : `Continue the presenter pose and studio from scene ${sceneNumber - 1}`,
      nextSceneContinuity:
        sceneNumber === count
          ? "Finish with the presenter holding the final pose"
          : `Prepare the visual handoff to scene ${sceneNumber + 1}`,
      negativeConstraints: ["No identity drift", "No extra dialogue"],
    };
  });
}

export const masterPrompt: MasterPromptIdentityRules = {
  videoObjective: "Teach a complete Facebook Ads workflow",
  targetAudience: "Bangla-speaking YouTube viewers",
  presenterIdentity: "Same young Bangladeshi male presenter in every scene",
  referenceImageRules: "Treat uploaded front-facing image as identity source of truth",
  faceConsistency: "Preserve exact face geometry",
  hairstyle: "Preserve exact hairstyle",
  beard: "Preserve exact beard",
  skinTone: "Preserve exact skin tone",
  bodyProportions: "Preserve natural body proportions",
  clothing: "Fitted black jacket and dark shirt",
  studio: "Premium dark navy technology studio",
  lighting: "Cinematic cyan and purple neon lighting",
  cameraLanguage: "Professional YouTube presenter cinematography",
  movementRules: "Natural blinking, breathing, eye focus, head movement and hand gestures",
  voiceRequirements: "Natural Bangla male voice with no extra dialogue",
  lipSyncRequirements: "Accurate phoneme-level lip sync",
  musicStyle: "Low energetic electronic background music",
  soundEffectStyle: "Clean clicks and restrained whooshes",
  textOverlayRules: "Only short intentional labels",
  sceneContinuity: "Maintain presenter, wardrobe, studio and lighting continuity",
  negativeConstraints: ["No robotic motion", "No distorted anatomy"],
};

export const avatar: AvatarPromptProfile = {
  avatarName: "Bijoy Presenter",
  referenceAssetIds: ["asset-front-001"],
  clothingDescription: "Fitted black jacket and dark shirt",
  studioDescription: "Premium dark navy technology studio",
  visualStyle: "Ultra-realistic professional YouTube presenter",
  language: "Bangla",
  accent: "Bangladesh",
  defaultCallToAction: "Subscribe to BigShortAds",
};

export const settings: ProjectPromptSettings = {
  aspectRatio: "16:9",
  width: 1920,
  height: 1080,
  durationSeconds: 10,
  nativeAudioMode: true,
};
