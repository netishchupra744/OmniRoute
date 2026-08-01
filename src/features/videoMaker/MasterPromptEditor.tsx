"use client";

import { useState } from "react";
import { Button, Card, Select, Textarea } from "@/shared/components";
import type { MasterRecord } from "./clientTypes";

interface MasterVersion extends MasterRecord {
  id: string;
  isCurrent: boolean;
  createdAt: string;
}

export default function MasterPromptEditor({
  projectId,
  initialPrompt,
  onError,
}: {
  projectId: string;
  initialPrompt: MasterRecord;
  onError: (message: string) => void;
}) {
  const [current, setCurrent] = useState(initialPrompt);
  const [promptText, setPromptText] = useState(initialPrompt.promptText);
  const [versions, setVersions] = useState<MasterVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  async function request(body: Record<string, unknown>) {
    setSaving(true);
    onError("");
    try {
      const response = await fetch(`/api/video-projects/${projectId}/master-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Master Prompt could not be changed.");
      setCurrent(payload.current);
      setPromptText(payload.current.promptText);
      setVersions(payload.versions || []);
      setSelectedVersion(payload.current.id || "");
      setEditing(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Master Prompt could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  async function loadVersions() {
    setSaving(true);
    onError("");
    try {
      const response = await fetch(`/api/video-projects/${projectId}/master-prompt`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Master Prompt history could not be loaded.");
      setVersions(payload.versions || []);
      setSelectedVersion(payload.current?.id || "");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Master Prompt history could not be loaded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={`Master Prompt · Version ${current.version}`}
      subtitle="Reusable identity, studio, movement, voice and continuity contract. Editing creates a new version; existing scenes are not silently overwritten."
    >
      {editing ? (
        <Textarea rows={18} value={promptText} onChange={(event) => setPromptText(event.target.value)} />
      ) : (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-4 text-xs leading-6 text-text-muted">
          {current.promptText}
        </pre>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={() => void request({ action: "edit", promptText })} loading={saving}>
              Save new version
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPromptText(current.promptText); setEditing(false); }}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Master Prompt</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => void loadVersions()} loading={saving}>
          Version history
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(current.promptText)}>
          Copy
        </Button>
      </div>
      {versions.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
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
            disabled={!selectedVersion}
            onClick={() => void request({ action: "restore", promptVersionId: selectedVersion })}
            loading={saving}
          >
            Restore as new version
          </Button>
        </div>
      )}
    </Card>
  );
}
