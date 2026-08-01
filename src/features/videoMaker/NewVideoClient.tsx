"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/shared/components";
import { useOnlineStatus, VideoMakerPageHeader } from "./ui";

interface AvatarProfileOption {
  id: string;
  name: string;
}
interface ModelOption {
  id: string;
}

export default function NewVideoClient() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [avatars, setAvatars] = useState<AvatarProfileOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    videoTitle: "",
    language: "bn",
    videoType: "YOUTUBE_TUTORIAL",
    avatarProfileId: "",
    llmModelId: "",
    visualStyle: "Realistic YouTube Presenter",
    audioMode: "NATIVE_VIDEO_AUDIO",
    sourceMaterial: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/avatar-profiles").then((response) => response.json()),
      fetch("/v1/models").then((response) => response.json()),
    ])
      .then(([avatarPayload, modelPayload]) => {
        if (cancelled) return;
        setAvatars(Array.isArray(avatarPayload.profiles) ? avatarPayload.profiles : []);
        const data = Array.isArray(modelPayload.data) ? modelPayload.data : [];
        setModels(data.filter((item: unknown) => item && typeof item === "object" && typeof (item as ModelOption).id === "string"));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load avatars or connected LLM models.");
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const llmOptions = useMemo(
    () => models.slice(0, 500).map((model) => ({ value: model.id, label: model.id })),
    [models]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!online) {
      setError("Offline — AI generation requires an internet connection.");
      return;
    }
    if (!form.avatarProfileId) {
      setError("Create or select an Avatar Profile first.");
      return;
    }
    if (!form.llmModelId) {
      setError("Select a connected LLM model for planning.");
      return;
    }
    setSubmitting(true);
    try {
      const createResponse = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sceneCount: 33,
          sceneDurationSeconds: 10,
          aspectRatio: "16:9",
          width: 1920,
          height: 1080,
          sourceMaterial: form.sourceMaterial || null,
        }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error || "Video project could not be created.");

      const planResponse = await fetch(`/api/video-projects/${created.project.id}/plan`, {
        method: "POST",
      });
      const planned = await planResponse.json();
      if (!planResponse.ok) {
        router.push(`/video-maker/projects/${created.project.id}`);
        throw new Error(planned.error || "Project was created, but planning failed.");
      }
      router.push(`/video-maker/projects/${created.project.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video planning failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <VideoMakerPageHeader
        title="New Video"
        description="Create one project Master Prompt and exactly 33 connected ten-second scenes. Planning uses your selected OmniRoute LLM connection."
      />
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Video details" subtitle="Required planning inputs">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              className="sm:col-span-2"
              label="Video title"
              required
              placeholder="How to Apply for a Facebook Ads Credit Line?"
              value={form.videoTitle}
              onChange={(event) => setForm({ ...form, videoTitle: event.target.value })}
            />
            <Select
              label="Language"
              value={form.language}
              onChange={(event) => setForm({ ...form, language: event.target.value })}
              options={[
                { value: "bn", label: "Bangla" },
                { value: "en", label: "English" },
              ]}
            />
            <Select
              label="Video type"
              value={form.videoType}
              onChange={(event) => setForm({ ...form, videoType: event.target.value })}
              options={[
                { value: "YOUTUBE_TUTORIAL", label: "YouTube Tutorial" },
                { value: "YOUTUBE_EXPLAINER", label: "YouTube Explainer" },
                { value: "PRODUCT_DEMO", label: "Product Demo" },
              ]}
            />
            <Select
              label="Avatar profile"
              required
              value={form.avatarProfileId}
              onChange={(event) => setForm({ ...form, avatarProfileId: event.target.value })}
              placeholder={avatars.length ? "Select avatar" : "No avatar profiles available"}
              options={avatars.map((avatar) => ({ value: avatar.id, label: avatar.name }))}
            />
            <Select
              label="Planning LLM"
              required
              value={form.llmModelId}
              onChange={(event) => setForm({ ...form, llmModelId: event.target.value })}
              placeholder={loadingData ? "Loading connected models…" : "Select LLM model"}
              options={llmOptions}
            />
            <Input
              className="sm:col-span-2"
              label="Visual style"
              value={form.visualStyle}
              onChange={(event) => setForm({ ...form, visualStyle: event.target.value })}
            />
            <Select
              className="sm:col-span-2"
              label="Voice strategy"
              value={form.audioMode}
              onChange={(event) => setForm({ ...form, audioMode: event.target.value })}
              options={[
                { value: "NATIVE_VIDEO_AUDIO", label: "Native Video Audio" },
                { value: "SEPARATE_API_VOICE", label: "Separate API Voice + Lip Sync" },
              ]}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text-main">Optional source material</label>
              <Textarea
                rows={8}
                placeholder="Paste tutorial steps, notes, transcript or product information."
                value={form.sourceMaterial}
                onChange={(event) => setForm({ ...form, sourceMaterial: event.target.value })}
              />
            </div>
          </div>
          {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" icon="auto_awesome" loading={submitting} disabled={!online}>
              {submitting ? "Creating and validating plan…" : "Create Full Video Plan"}
            </Button>
            {avatars.length === 0 && (
              <Link href="/video-maker/avatars" className="text-sm font-medium text-accent hover:underline">
                Create an Avatar Profile
              </Link>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Fixed timeline" icon="schedule">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-text-muted">Scenes</dt><dd className="font-semibold text-text-main">33</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Each scene</dt><dd className="font-semibold text-text-main">10 seconds</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Total</dt><dd className="font-semibold text-text-main">5:30</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Aspect ratio</dt><dd className="font-semibold text-text-main">16:9</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Resolution</dt><dd className="font-semibold text-text-main">1920×1080</dd></div>
            </dl>
          </Card>
          <Card title="Provider truth" icon="verified_user">
            <p className="text-sm leading-6 text-text-muted">
              Planning does not claim that every video provider supports Bangla voice, reference identity, lip-sync, exact 10 seconds or 1080p. Generation models remain blocked until all selected requirements are compatible.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
