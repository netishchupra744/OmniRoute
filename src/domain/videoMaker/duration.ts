export const DEFAULT_SCENE_COUNT = 33;
export const DEFAULT_SCENE_DURATION_SECONDS = 10;
export const EXPECTED_FINAL_DURATION_SECONDS = 330;

export function calculateFinalDurationSeconds(
  sceneCount: number,
  sceneDurationSeconds: number
): number {
  if (!Number.isInteger(sceneCount) || sceneCount <= 0) {
    throw new RangeError("sceneCount must be a positive integer");
  }
  if (!Number.isFinite(sceneDurationSeconds) || sceneDurationSeconds <= 0) {
    throw new RangeError("sceneDurationSeconds must be greater than zero");
  }
  return sceneCount * sceneDurationSeconds;
}

export function assertBijoyDefaultDuration(
  sceneCount: number,
  sceneDurationSeconds: number
): void {
  const total = calculateFinalDurationSeconds(sceneCount, sceneDurationSeconds);
  if (
    sceneCount !== DEFAULT_SCENE_COUNT ||
    sceneDurationSeconds !== DEFAULT_SCENE_DURATION_SECONDS ||
    total !== EXPECTED_FINAL_DURATION_SECONDS
  ) {
    throw new Error(
      `Bijoy default timeline must be 33 scenes × 10 seconds = 330 seconds; received ${sceneCount} × ${sceneDurationSeconds} = ${total}`
    );
  }
}
