import {
  buildScenePlanRepairInstruction,
  validateScenePlan,
} from "./scenePlanValidation.ts";
import type {
  ScenePlan,
  ScenePlanValidationOptions,
  ScenePlanValidationResult,
} from "./types.ts";

export interface ScenePlannerAttempt {
  attempt: number;
  rawResponse: string;
  parsed: boolean;
  validation: ScenePlanValidationResult;
}

export interface GenerateValidatedScenePlanInput {
  initialPrompt: string;
  invokeLlm: (prompt: string, attempt: number) => Promise<string>;
  validationOptions?: ScenePlanValidationOptions;
  maximumAttempts?: number;
  onAttempt?: (attempt: ScenePlannerAttempt) => void | Promise<void>;
}

export class ScenePlanGenerationError extends Error {
  readonly attempts: ScenePlannerAttempt[];

  constructor(message: string, attempts: ScenePlannerAttempt[]) {
    super(message);
    this.name = "ScenePlanGenerationError";
    this.attempts = attempts;
  }
}

function parseStrictJson(rawResponse: string): unknown {
  const trimmed = rawResponse.trim();
  if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
    throw new SyntaxError("Markdown code fences are not accepted; return raw JSON only.");
  }
  return JSON.parse(trimmed);
}

function parseFailureResult(message: string): ScenePlanValidationResult {
  return {
    ok: false,
    errors: [`Invalid JSON: ${message}`],
    warnings: [],
    totalDurationSeconds: 0,
  };
}

export async function generateValidatedScenePlan(
  input: GenerateValidatedScenePlanInput
): Promise<ScenePlan[]> {
  const maximumAttempts = input.maximumAttempts ?? 3;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }

  const attempts: ScenePlannerAttempt[] = [];
  let prompt = input.initialPrompt;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const rawResponse = await input.invokeLlm(prompt, attempt);
    let parsed: unknown;
    let parsedOk = true;
    let validation: ScenePlanValidationResult;

    try {
      parsed = parseStrictJson(rawResponse);
      validation = validateScenePlan(parsed, input.validationOptions);
    } catch (error) {
      parsedOk = false;
      validation = parseFailureResult(error instanceof Error ? error.message : String(error));
    }

    const attemptRecord: ScenePlannerAttempt = {
      attempt,
      rawResponse,
      parsed: parsedOk,
      validation,
    };
    attempts.push(attemptRecord);
    await input.onAttempt?.(attemptRecord);

    if (validation.ok) {
      return parsed as ScenePlan[];
    }

    if (attempt < maximumAttempts) {
      prompt = [
        buildScenePlanRepairInstruction(validation),
        "",
        "INVALID OUTPUT TO REPAIR:",
        rawResponse,
      ].join("\n");
    }
  }

  const finalErrors = attempts.at(-1)?.validation.errors ?? ["Unknown scene-plan failure."];
  throw new ScenePlanGenerationError(
    `Unable to produce a valid scene plan after ${maximumAttempts} attempts: ${finalErrors.join("; ")}`,
    attempts
  );
}
