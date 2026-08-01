"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Select } from "@/shared/components";
import MasterPromptEditor from "./MasterPromptEditor";
import SceneEditorPanel from "./SceneEditorPanel";
import type {
  MasterRecord,
  ProjectRecord,
  SceneJobRecord,
  SceneRecord,
  VideoModelOption,
} from "./clientTypes";
import { ProjectStatusBadge, useOnlineStatus, VideoMakerPageHeader } from "./ui";

interface RenderJobRecord {
  id: string;
  providerId: string;
  status: string;
  statusMessage: string | null;
  errorMessage: string | null;
  outputUrl: string | null;
  reportedDurationSeconds: number | null;
}

export default function ProjectDetailClient({
  initialProject,
  initialScenes,
  masterPrompt,
}: {
  initialProject: ProjectRecord;
  initialScenes: SceneRecord[];
  masterPrompt: MasterRecord | null;
}) {
  const online = useOnlineStatus();
  const [project, setProject] = useState(initialProject);
  const [scenes, setScenes] = useState(initialScenes);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [cancellingRender, setCancellingRender] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initialProject.lastErrorMessage || "");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [models, setModels] = useState<VideoModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [jobs, setJobs] = useState<SceneJobRecord[]>([]);
  const [renderJobs, setRenderJobs] = useState<RenderJobRecord[]>([]);

  const latestJobByScene = useMemo(() => {
    const map = new Map<string, SceneJobRecord>();
    for (const job of jobs) if (!map.has(job.sceneId)) map.set(job.sceneId, job);
    return map;
  }, [jobs]);

  useEffect(() => {
    let cancelled = false;
    const nativeAudio = project.settings?.audioMode !== "SEPARATE_API_VOICE";
    fetch("/api/video-maker/provider-capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: nativeAudio ? "native-video-audio" : "separate-api-voice",
        requiresReferenceImage: true,
        requiresBanglaVoice: nativeAudio,
        requiresLipSync: nativeAudio,
        durationSeconds: 10,
        aspectRatio: "16:9",
        width: 1920,
        height: 1080,
        requiresAsyncJobs: true,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Provider capabilities could not be loaded.");
        if (!cancelled) {
          const compatible = Array.isArray(payload.compatibleModels) ? payload.compatibleModels : [];
          setModels(compatible);
          const preferred = compatible.find(
            (item: VideoModelOption) =>
              item.providerId === project.settings?.videoProviderId &&
              item.modelId === project.settings?.videoModelId
          );
          const first = preferred || compatible[0];
          setSelectedModel(first ? `${first.providerId}\u0000${first.modelId}` : "");
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Provider capabilities could not be loaded.");
      });
    void loadStatuses(false);
    return () => {
      cancelled = true;
    };
    // Stable project identity/settings for this screen instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function loadStatuses(showSpinner = true) {
    if (showSpinner) setRefreshing(true);
    try {
      const [jobResponse, renderResponse, projectResponse, sceneResponse] = await Promise.all([
        fetch(`/api/video-projects/${project.id}/generation-jobs`),
        fetch(`/api/video-projects/${project.id}/render`),
        fetch(`/api/video-projects/${project.id}`),
        fetch(`/api/video-projects/${project.id}/scenes`),
      ]);
      const [jobPayload, renderPayload, projectPayload, scenePayload] = await Promise.all([
        jobResponse.json(),
        renderResponse.json(),
        projectResponse.json(),
        sceneResponse.json(),
      ]);
      if (jobResponse.ok) setJobs(jobPayload.jobs || []);
      if (renderResponse.ok) setRenderJobs(renderPayload.jobs || []);
      if (projectResponse.ok) setProject(projectPayload.project);
      if (sceneResponse.ok) setScenes(scenePayload.scenes || []);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }

  async function plan() {
    if (!online) {
      setError("Offline — AI generation requires an internet connection.");
      return;
    }
    setPlanning(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/video-projects/${project.id}/plan`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Planning failed.");
      setProject(payload.project);
      setScenes(payload.scenes || []);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  async function toggleLock(scene: SceneRecord) {
    setError("");
    const response = await fetch(`/api/video-projects/${project.id}/scenes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId: scene.id, locked: !scene.locked }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Scene lock could not be changed.");
      return;
    }
    setScenes((current) => current.map((item) => item.id === scene.id ? payload.scene : item));
  }

  async function generateAll() {
    if (!online) {
      setError("Offline — AI generation requires an internet connection.");
      return;
    }
    if (!selectedModel) {
      setError(
        "No verified compatible video model is available. Connect and contract-test a provider that supports the avatar reference, exact 10 seconds, 16:9, 1080p and the selected voice mode."
      );
      return;
    }
    const [providerId, modelId] = selectedModel.split("\u0000");
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/video-projects/${project.id}/generation-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, modelId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const reasons = Array.isArray(payload.reasons) ? ` ${payload.reasons.join(" ")}` : "";
        throw new Error(`${payload.error || "Scene jobs could not be created."}${reasons}`);
      }
      setJobs(payload.jobs || []);
      const pumpResponse = await fetch("/api/video-maker/jobs/pump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online: true, limit: 33 }),
      });
      const pump = await pumpResponse.json();
      if (pumpResponse.ok && Array.isArray(pump.blocked) && pump.blocked.length > 0) {
        setNotice(`Jobs were saved, but provider submission is blocked: ${pump.blocked[0].reason}`);
      } else {
        setNotice("All eligible scene jobs were saved and the provider queue was advanced.");
      }
      await loadStatuses(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scene generation could not start.");
    } finally {
      setGenerating(false);
    }
  }

  async function cancelJob(job: SceneJobRecord) {
    setError("");
    const response = await fetch(`/api/video-projects/${project.id}/generation-jobs/${job.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Scene job could not be cancelled.");
      return;
    }
    await loadStatuses(false);
  }

  async function restartJob(job: SceneJobRecord) {
    if (!online) {
      setError("Offline — AI generation requires an internet connection.");
      return;
    }
    setError("");
    const response = await fetch(`/api/video-projects/${project.id}/generation-jobs/${job.id}`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Scene job could not be restarted.");
      return;
    }
    setNotice(job.status === "COMPLETED" ? "Scene regeneration queued." : "Scene retry queued.");
    await loadStatuses(false);
  }

  async function cancelRenderJob() {
    if (!currentRenderJob) return;
    setCancellingRender(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/video-projects/${project.id}/render/${currentRenderJob.id}`,
        { method: "DELETE" }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Final render could not be cancelled.");
      setNotice("Final render cancelled.");
      await loadStatuses(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Final render could not be cancelled.");
    } finally {
      setCancellingRender(false);
    }
  }

  async function renderFinalVideo() {
    if (!online) {
      setError("Offline — AI generation requires an internet connection.");
      return;
    }
    setRendering(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/video-projects/${project.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Final render could not start.");
      setNotice("The 33-scene cloud render job was submitted.");
      await loadStatuses(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Final render could not start.");
    } finally {
      setRendering(false);
    }
  }

  const currentRenderJob = renderJobs[0] || null;

  return (
    <div className="space-y-6">
      <VideoMakerPageHeader
        title={project.name}
        description={project.videoTitle}
        action={
          <div className="flex items-center gap-3">
            <ProjectStatusBadge status={project.status} />
            <Link href="/video-maker/projects" className="text-sm text-accent hover:underline">All Projects</Link>
          </div>
        }
      />
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="rounded-lg bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">{notice}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Scenes", scenes.length || project.settings?.sceneCount || 33],
          ["Per scene", `${project.settings?.sceneDurationSeconds || 10}s`],
          ["Total", "5:30"],
          ["Format", project.settings?.aspectRatio || "16:9"],
          ["Resolution", `${project.settings?.width || 1920}×${project.settings?.height || 1080}`],
        ].map(([label, value]) => (
          <Card key={String(label)} padding="sm">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold text-text-main">{value}</p>
          </Card>
        ))}
      </div>

      {scenes.length === 0 ? (
        <Card title="Create the full video plan" subtitle="The selected LLM will generate and validate one Master Prompt plus exactly 33 scenes.">
          <Button onClick={() => void plan()} loading={planning} disabled={!online} icon="auto_awesome">Create Full Video Plan</Button>
        </Card>
      ) : (
        <>
          {masterPrompt && <MasterPromptEditor projectId={project.id} initialPrompt={masterPrompt} onError={setError} />}

          <Card title="Generation and final render" subtitle="Only source-verified compatible models are selectable. Statuses come from persistent provider jobs, not simulated progress.">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
              <Select
                label="Compatible video model"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                placeholder={models.length ? "Select model" : "No verified compatible model"}
                options={models.map((model) => ({
                  value: `${model.providerId}\u0000${model.modelId}`,
                  label: `${model.providerDisplayName} · ${model.displayName}`,
                }))}
              />
              <Button onClick={() => void generateAll()} loading={generating} disabled={!online || models.length === 0} icon="movie">
                Generate All 33 Scenes
              </Button>
              <Button variant="secondary" onClick={() => void loadStatuses()} loading={refreshing} icon="refresh">
                Refresh Status
              </Button>
              <Button
                variant="secondary"
                onClick={() => void renderFinalVideo()}
                loading={rendering}
                disabled={!online || project.status !== "READY_TO_RENDER"}
                icon="video_file"
              >
                Render Final 5:30 Video
              </Button>
            </div>
            {models.length === 0 && (
              <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                No model in this checked source version is yet verified for all presenter requirements together. This blocks paid submission rather than pretending an unsupported model will work.
              </p>
            )}
            {currentRenderJob && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg bg-bg p-3 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Render: <strong className="text-text-main">{currentRenderJob.status}</strong>
                  {currentRenderJob.statusMessage ? ` · ${currentRenderJob.statusMessage}` : ""}
                  {currentRenderJob.errorMessage ? ` · ${currentRenderJob.errorMessage}` : ""}
                </p>
                {["QUEUED", "SUBMITTING", "PROCESSING", "DOWNLOADING", "RETRYING"].includes(currentRenderJob.status) && (
                  <Button size="sm" variant="danger" loading={cancellingRender} onClick={() => void cancelRenderJob()}>
                    Cancel Render
                  </Button>
                )}
              </div>
            )}
            {(project.finalOutputUrl || currentRenderJob?.outputUrl) && (
              <a
                href={project.finalOutputUrl || currentRenderJob?.outputUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-white"
              >
                Download Final MP4
              </a>
            )}
          </Card>

          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-main">33-Scene Plan and Job Grid</h2>
                <p className="text-sm text-text-muted">Edit versioned prompts, lock scenes, inspect real jobs, retry and regenerate individually.</p>
              </div>
              <Button variant="secondary" onClick={() => void plan()} loading={planning} disabled={!online}>Regenerate unlocked plan</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scenes.map((scene) => {
                const job = latestJobByScene.get(scene.id);
                const visibleStatus = job?.status || scene.status;
                return (
                  <Card key={scene.id} padding="sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-accent">SCENE {scene.sceneNumber} · {scene.durationSeconds}s</p>
                        <h3 className="mt-1 font-semibold text-text-main">{scene.title}</h3>
                      </div>
                      <span className="text-xs text-text-muted">{visibleStatus}</span>
                    </div>
                    <p className="mt-3 text-sm text-text-muted">{scene.purpose}</p>
                    <p className="mt-3 rounded-lg bg-bg p-3 text-sm text-text-main">“{scene.exactDialogue}”</p>
                    {job && (
                      <div className="mt-3 space-y-1 rounded-lg border border-border p-3 text-xs text-text-muted">
                        <p><strong className="text-text-main">{job.providerId}/{job.modelId}</strong></p>
                        <p>Attempt {job.attemptCount}/{job.maximumAttempts}</p>
                        {job.statusMessage && <p>{job.statusMessage}</p>}
                        {job.errorMessage && <p className="text-red-500">{job.errorMessage}</p>}
                        {job.outputDurationSeconds != null && <p>Reported duration: {job.outputDurationSeconds}s</p>}
                        {(job.actualCostUsd ?? job.estimatedCostUsd) != null && (
                          <p>Cost: ${(job.actualCostUsd ?? job.estimatedCostUsd ?? 0).toFixed(4)}</p>
                        )}
                      </div>
                    )}
                    {expanded === scene.id && (
                      <SceneEditorPanel
                        projectId={project.id}
                        scene={scene}
                        onError={setError}
                        onSceneChanged={(updated) =>
                          setScenes((current) => current.map((item) => item.id === updated.id ? updated : item))
                        }
                      />
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setExpanded(expanded === scene.id ? null : scene.id)}>
                        {expanded === scene.id ? "Close editor" : "Edit / versions"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleLock(scene)} icon={scene.locked ? "lock" : "lock_open"}>
                        {scene.locked ? "Locked" : "Lock"}
                      </Button>
                      {scene.currentPromptText && (
                        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(scene.currentPromptText || "")}>Copy prompt</Button>
                      )}
                      {job?.outputUrl && (
                        <a href={job.outputUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center rounded-control px-3 text-xs font-medium text-accent hover:bg-black/5 dark:hover:bg-white/5">
                          Preview / Download
                        </a>
                      )}
                      {job && ["QUEUED", "SUBMITTING", "PROCESSING", "DOWNLOADING", "RETRYING"].includes(job.status) && (
                        <Button size="sm" variant="danger" onClick={() => void cancelJob(job)}>Cancel</Button>
                      )}
                      {job && ["FAILED", "CANCELLED", "COMPLETED"].includes(job.status) && (
                        <Button size="sm" variant="secondary" onClick={() => void restartJob(job)} disabled={!online}>
                          {job.status === "COMPLETED" ? "Regenerate" : "Retry"}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
