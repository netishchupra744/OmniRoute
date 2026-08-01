import type { FinalRenderTimeline } from "../../domain/videoMaker/renderTimeline.ts";
import type { RetryErrorKind } from "../../domain/videoMaker/types.ts";

export interface FinalRenderOptions {
  subtitles?: boolean;
  logoUrl?: string | null;
  backgroundMusicUrl?: string | null;
  soundEffects?: boolean;
  titleCard?: boolean;
  outroBranding?: boolean;
}

export interface FinalRenderSubmitInput {
  projectId: string;
  modelId: string | null;
  idempotencyKey: string;
  timeline: FinalRenderTimeline;
  options: FinalRenderOptions;
}

export type FinalRenderProviderResult =
  | {
      state: "processing";
      taskId: string;
      pollAfterMs?: number;
      estimatedCostUsd?: number;
      rawResponse?: unknown;
    }
  | {
      state: "completed";
      outputUrl?: string;
      storageKey?: string;
      reportedDurationSeconds?: number;
      actualCostUsd?: number;
      rawResponse?: unknown;
    };

export type FinalRenderPollResult =
  | {
      state: "processing";
      pollAfterMs?: number;
      rawResponse?: unknown;
    }
  | {
      state: "completed";
      outputUrl?: string;
      storageKey?: string;
      reportedDurationSeconds?: number;
      actualCostUsd?: number;
      rawResponse?: unknown;
    }
  | {
      state: "failed";
      kind: RetryErrorKind;
      code: string;
      message: string;
      rawResponse?: unknown;
    };

export interface FinalRenderProviderAdapter {
  providerId: string;
  displayName: string;
  submit(input: FinalRenderSubmitInput): Promise<FinalRenderProviderResult>;
  poll(input: { taskId: string; modelId: string | null }): Promise<FinalRenderPollResult>;
  cancel?(input: { taskId: string; modelId: string | null }): Promise<void>;
}

const adapters = new Map<string, FinalRenderProviderAdapter>();

export function registerFinalRenderProviderAdapter(adapter: FinalRenderProviderAdapter): void {
  const providerId = adapter.providerId.trim();
  if (!providerId) throw new Error("Final render providerId is required.");
  if (adapters.has(providerId)) {
    throw new Error(`Final render provider '${providerId}' is already registered.`);
  }
  adapters.set(providerId, adapter);
}

export function unregisterFinalRenderProviderAdapter(providerId: string): void {
  adapters.delete(providerId);
}

export function getFinalRenderProviderAdapter(
  providerId: string
): FinalRenderProviderAdapter | null {
  return adapters.get(providerId) ?? null;
}

export function listFinalRenderProviderAdapters(): Array<{
  providerId: string;
  displayName: string;
}> {
  return [...adapters.values()]
    .map(({ providerId, displayName }) => ({ providerId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
