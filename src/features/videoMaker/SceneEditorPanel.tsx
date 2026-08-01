"use client";

import { useState } from "react";
import { Button, Select, Textarea } from "@/shared/components";
import type { SceneRecord } from "./clientTypes";

interface VersionRecord {
  id: string;
  version: number;
  promptText: string;
  exactDialogue: string;
  isCurrent: boolean;
  createdAt: string;
}

export default function SceneEditorPanel({
  projectId,
  scene,
  onSceneChanged,
  onError,
}: {
  projectId: string;
  scene: SceneRecord;
  onSceneChanged: (scene: SceneRecord) => void;
  onError: (message: string) => void;
}) {
  const [promptText, setPromptText] = useState(scene.currentPromptText || "");
  const [exactDialogue, setExactDialogue] = useState(scene.exactDialogue);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  async function loadVersions() {
    setLoadingVersions(true);
    onError("");
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/scenes/${scene.id}/prompt-versions`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Prompt versions could not be loaded.");
      setVersions(payload.versions || []);
      const current = (payload.versions || []).find((item: VersionRecord) => item.isCurrent);
      setSelectedVersion(current?.id || "");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Prompt versions could not be loaded.");
    } finally {
      setLoadingVersions(false);
    }
  }

  async function save() {
    setSaving(true);
    onError("");
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/scenes/${scene.id}/prompt-versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", promptText, exactDialogue }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Scene prompt could not be saved.");
      onSceneChanged(payload.scene);
      setPromptText(payload.scene.currentPromptText || "");
      setExactDialogue(payload.scene.exactDialogue);
      setVersions(payload.versions || []);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Scene prompt could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!selectedVersion) return;
    setSaving(true);
    onError("");
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/scenes/${scene.id}/prompt-versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore", promptVersionId: selectedVersion }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Prompt version could not be restored.");
      onSceneChanged(payload.scene);
      setPromptText(payload.scene.currentPromptText || "");
      setExactDialogue(payload.scene.exactDialogue);
      setVersions(payload.versions || []);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Prompt version could not be restored.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border p-4">
      {scene.locked && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          This scene is locked. Unlock it before editing or restoring a prompt.
        </p>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-main">Exact dialogue</label>
        <Textarea
          rows={3}
          value={exactDialogue}
          disabled={scene.locked}
          onChange={(event) => setExactDialogue(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-main">Self-contained scene prompt</label>
        <Textarea
          rows={14}
          value={promptText}
          disabled={scene.locked}
          onChange={(event) => setPromptText(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void save()} loading={saving} disabled={scene.locked}>
          Save new version
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void loadVersions()} loading={loadingVersions}>
          Load version history
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(promptText)}
          disabled={!promptText}
        >
          Copy prompt
        </Button>
      </div>
      {versions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select
            value={selectedVersion}
            onChange={(event) => setSelectedVersion(event.target.value)}
            options={versions.map((version) => ({
              value: version.id,
              label: `Version ${version.version}${version.isCurrent ? " · Current" : ""} · ${new Date(version.createdAt).toLocaleString()}`,
            }))}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void restore()}
            loading={saving}
            disabled={scene.locked || !selectedVersion}
          >
            Restore as new version
          </Button>
        </div>
      )}
    </div>
  );
}
