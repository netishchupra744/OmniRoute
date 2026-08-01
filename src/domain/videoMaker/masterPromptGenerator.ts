import {
  buildMasterPromptRepairInstruction,
  validateMasterPromptIdentityRules,
} from "./masterPrompt.ts";
import type { MasterPromptIdentityRules } from "./types.ts";

export interface MasterPromptAttempt {
  attempt: number;
  rawResponse: string;
  parsed: boolean;
  errors: string[];
}

export class MasterPromptGenerationError extends Error {
  readonly attempts: MasterPromptAttempt[];

  constructor(message: string, attempts: MasterPromptAttempt[]) {
    super(message);
    this.name = "MasterPromptGenerationError";
    this.attempts = attempts;
  }
}

export async function generateValidatedMasterPrompt(input: {
  initialPrompt: string;
  invokeLlm: (prompt: string, attempt: number) => Promise<string>;
  maximumAttempts?: number;
  onAttempt?: (attempt: MasterPromptAttempt) => void | Promise<void>;
}): Promise<MasterPromptIdentityRules> {
  const maximumAttempts = input.maximumAttempts ?? 3;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer.");
  }

  const attempts: MasterPromptAttempt[] = [];
  let prompt = input.initialPrompt;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const rawResponse = await input.invokeLlm(prompt, attempt);
    let parsed: unknown = null;
    let parsedOk = true;
    let errors: string[] = [];
    try {
      const trimmed = rawResponse.trim();
      if (trimmed.startsWith("```") || trimmed.endsWith("```")) {
        throw new SyntaxError("Markdown code fences are not accepted; return raw JSON only.");
      }
      parsed = JSON.parse(trimmed);
      const validation = validateMasterPromptIdentityRules(parsed);
      errors = validation.errors;
      if (validation.ok && validation.value) return validation.value;
    } catch (error) {
      parsedOk = false;
      errors = [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
    }

    const attemptRecord = { attempt, rawResponse, parsed: parsedOk, errors };
    attempts.push(attemptRecord);
    await input.onAttempt?.(attemptRecord);

    if (attempt < maximumAttempts) {
      prompt = [
        buildMasterPromptRepairInstruction(errors),
        "",
        "INVALID OUTPUT TO REPAIR:",
        rawResponse,
      ].join("\n");
    }
  }

  throw new MasterPromptGenerationError(
    `Unable to produce a valid Master Prompt after ${maximumAttempts} attempts: ${attempts.at(-1)?.errors.join("; ") || "unknown validation error"}`,
    attempts
  );
}
