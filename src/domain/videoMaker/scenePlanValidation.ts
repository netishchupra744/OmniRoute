import type {
  ScenePlan,
  ScenePlanValidationOptions,
  ScenePlanValidationResult,
} from "./types.ts";

const REQUIRED_STRING_FIELDS: Array<keyof ScenePlan> = [
  "title",
  "purpose",
  "exactDialogue",
  "presenterAction",
  "visualDescription",
  "backgroundDescription",
  "screenContent",
  "cameraShot",
  "cameraMovement",
  "lighting",
  "soundEffects",
  "musicDirection",
  "transitionIn",
  "transitionOut",
  "previousSceneContinuity",
  "nextSceneContinuity",
];

const STORY_BEATS: Record<string, string[]> = {
  hook: ["hook", "হুক", "মনোযোগ", "attention"],
  resultPreview: ["result preview", "preview", "ফলাফল", "আগাম ফল"],
  learningPromise: ["learning promise", "promise", "শিখবেন", "যা শিখবেন"],
  requirements: ["requirements", "requirement", "প্রয়োজন", "যা লাগবে"],
  mainTutorial: ["tutorial", "step", "টিউটোরিয়াল", "ধাপ"],
  troubleshooting: ["troubleshoot", "troubleshooting", "সমস্যা", "সমাধান"],
  summary: ["summary", "recap", "সারাংশ", "সংক্ষেপ"],
  callToAction: ["call to action", "cta", "subscribe", "সাবস্ক্রাইব", "কমেন্ট"],
  outro: ["outro", "ending", "সমাপ্তি", "শেষ"],
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStoryBeat(scenes: ScenePlan[], terms: string[]): boolean {
  return scenes.some((scene) => {
    const searchable = normalized(`${scene.title} ${scene.purpose}`);
    return terms.some((term) => searchable.includes(normalized(term)));
  });
}

export function validateScenePlan(
  input: unknown,
  options: ScenePlanValidationOptions = {}
): ScenePlanValidationResult {
  const expectedSceneCount = options.expectedSceneCount ?? 33;
  const expectedDurationSeconds = options.expectedDurationSeconds ?? 10;
  const maximumDialogueWords = options.maximumDialogueWords ?? 32;
  const requireStoryBeats = options.requireStoryBeats ?? true;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: ["Scene plan must be a JSON array."],
      warnings,
      totalDurationSeconds: 0,
    };
  }

  if (input.length !== expectedSceneCount) {
    errors.push(`Expected exactly ${expectedSceneCount} scenes, received ${input.length}.`);
  }

  const scenes: ScenePlan[] = [];
  const sceneNumbers = new Set<number>();
  const dialogueOwners = new Map<string, number>();
  const purposeOwners = new Map<string, number>();
  let totalDurationSeconds = 0;

  input.forEach((rawScene, index) => {
    const displayNumber = index + 1;
    if (!isPlainObject(rawScene)) {
      errors.push(`Scene at array index ${index} must be an object.`);
      return;
    }

    const scene = rawScene as unknown as ScenePlan;
    if (!Number.isInteger(scene.sceneNumber)) {
      errors.push(`Scene ${displayNumber}: sceneNumber must be an integer.`);
    } else {
      if (sceneNumbers.has(scene.sceneNumber)) {
        errors.push(`Duplicate sceneNumber ${scene.sceneNumber}.`);
      }
      sceneNumbers.add(scene.sceneNumber);
      if (scene.sceneNumber !== displayNumber) {
        errors.push(
          `Scene array position ${displayNumber} must have sceneNumber ${displayNumber}; received ${scene.sceneNumber}.`
        );
      }
    }

    if (scene.durationSeconds !== expectedDurationSeconds) {
      errors.push(
        `Scene ${displayNumber}: durationSeconds must equal ${expectedDurationSeconds}; received ${String(scene.durationSeconds)}.`
      );
    }
    if (Number.isFinite(scene.durationSeconds)) {
      totalDurationSeconds += scene.durationSeconds;
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = scene[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`Scene ${displayNumber}: ${String(field)} must be a non-empty string.`);
      }
    }

    if (!Array.isArray(scene.textOverlays) || !scene.textOverlays.every((v) => typeof v === "string")) {
      errors.push(`Scene ${displayNumber}: textOverlays must be an array of strings.`);
    }
    if (
      !Array.isArray(scene.negativeConstraints) ||
      scene.negativeConstraints.length === 0 ||
      !scene.negativeConstraints.every((v) => typeof v === "string" && v.trim().length > 0)
    ) {
      errors.push(`Scene ${displayNumber}: negativeConstraints must contain non-empty strings.`);
    }

    if (typeof scene.exactDialogue === "string") {
      const dialogue = normalized(scene.exactDialogue);
      if (dialogue) {
        const previous = dialogueOwners.get(dialogue);
        if (previous !== undefined) {
          errors.push(`Scenes ${previous} and ${displayNumber} contain duplicate exactDialogue.`);
        } else {
          dialogueOwners.set(dialogue, displayNumber);
        }
      }
      const words = wordCount(scene.exactDialogue);
      if (words > maximumDialogueWords) {
        errors.push(
          `Scene ${displayNumber}: exactDialogue has ${words} words; maximum is ${maximumDialogueWords} for a ${expectedDurationSeconds}-second scene.`
        );
      }
    }

    if (typeof scene.purpose === "string") {
      const purpose = normalized(scene.purpose);
      if (purpose) {
        const previous = purposeOwners.get(purpose);
        if (previous !== undefined) {
          errors.push(`Scenes ${previous} and ${displayNumber} contain duplicate purpose.`);
        } else {
          purposeOwners.set(purpose, displayNumber);
        }
      }
    }

    scenes.push(scene);
  });

  for (let sceneNumber = 1; sceneNumber <= expectedSceneCount; sceneNumber += 1) {
    if (!sceneNumbers.has(sceneNumber)) {
      errors.push(`Missing sceneNumber ${sceneNumber}.`);
    }
  }

  const expectedTotal = expectedSceneCount * expectedDurationSeconds;
  if (input.length === expectedSceneCount && totalDurationSeconds !== expectedTotal) {
    errors.push(
      `Total duration must equal ${expectedTotal} seconds; received ${totalDurationSeconds} seconds.`
    );
  }

  if (requireStoryBeats && scenes.length > 0) {
    for (const [beat, terms] of Object.entries(STORY_BEATS)) {
      if (!hasStoryBeat(scenes, terms)) {
        errors.push(`Required story beat is missing: ${beat}.`);
      }
    }
  }

  if (scenes.length > 1) {
    for (let index = 1; index < scenes.length; index += 1) {
      const previous = scenes[index - 1];
      const current = scenes[index];
      if (
        normalized(previous.nextSceneContinuity) === "none" ||
        normalized(current.previousSceneContinuity) === "none"
      ) {
        warnings.push(
          `Scenes ${index} and ${index + 1} use a weak continuity marker ("none").`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalDurationSeconds,
  };
}

export function buildScenePlanRepairInstruction(result: ScenePlanValidationResult): string {
  if (result.ok) return "No repair is required.";
  return [
    "Repair the scene-plan JSON and return JSON only.",
    "Do not add markdown fences or commentary.",
    "Fix every validation error below without changing valid scene intent unnecessarily:",
    ...result.errors.map((error, index) => `${index + 1}. ${error}`),
  ].join("\n");
}
