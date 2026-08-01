import type { SceneVideoProviderAdapter } from "./sceneJobOrchestrator.ts";

export interface RegisteredSceneVideoProviderAdapter extends SceneVideoProviderAdapter {
  displayName: string;
  maxConcurrent?: number;
  rateLimitCategory?: string;
}

const adapters = new Map<string, RegisteredSceneVideoProviderAdapter>();

export function registerSceneVideoProviderAdapter(
  adapter: RegisteredSceneVideoProviderAdapter
): void {
  const providerId = adapter.providerId.trim();
  if (!providerId) throw new Error("Scene video providerId is required.");
  if (adapters.has(providerId)) {
    throw new Error(`Scene video provider '${providerId}' is already registered.`);
  }
  if (
    adapter.maxConcurrent !== undefined &&
    (!Number.isInteger(adapter.maxConcurrent) || adapter.maxConcurrent < 1)
  ) {
    throw new Error("Scene video provider maxConcurrent must be a positive integer.");
  }
  adapters.set(providerId, adapter);
}

export function unregisterSceneVideoProviderAdapter(providerId: string): void {
  adapters.delete(providerId);
}

export function getSceneVideoProviderAdapter(
  providerId: string
): RegisteredSceneVideoProviderAdapter | null {
  return adapters.get(providerId) ?? null;
}

export function listSceneVideoProviderAdapters(): Array<{
  providerId: string;
  displayName: string;
  maxConcurrent: number;
  rateLimitCategory: string;
}> {
  return [...adapters.values()]
    .map((adapter) => ({
      providerId: adapter.providerId,
      displayName: adapter.displayName,
      maxConcurrent: adapter.maxConcurrent ?? 1,
      rateLimitCategory: adapter.rateLimitCategory ?? "provider-defined",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
