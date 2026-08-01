"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Textarea } from "@/shared/components";
import { VideoMakerPageHeader } from "./ui";

interface Asset { id: string; assetRole: string; }
interface Profile {
  id: string;
  name: string;
  defaultVisualStyle: string;
  language: string;
  accent: string;
  assets: Asset[];
}

export default function AvatarsClient() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  async function load() {
    const response = await fetch("/api/avatar-profiles");
    const payload = await response.json();
    if (response.ok) setProfiles(payload.profiles || []);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/avatar-profiles", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Avatar could not be saved.");
      setFormKey((value) => value + 1);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Avatar could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(profile: Profile) {
    if (!window.confirm(`Delete avatar “${profile.name}” and its local reference files?`)) return;
    const response = await fetch(`/api/avatar-profiles/${profile.id}`, { method: "DELETE" });
    if (response.ok) setProfiles((current) => current.filter((item) => item.id !== profile.id));
  }

  return (
    <div className="space-y-6">
      <VideoMakerPageHeader title="Avatar Profiles" description="Store validated presenter reference images locally. No local AI face processing is performed." />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Create Avatar Profile" subtitle="Front-facing reference image is required.">
          <form key={formKey} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Input className="sm:col-span-2" name="name" label="Avatar name" required />
            <Input name="language" label="Language" defaultValue="bn" required />
            <Input name="accent" label="Accent" defaultValue="Bangla (Bangladesh)" required />
            <Input className="sm:col-span-2" name="defaultVisualStyle" label="Default visual style" defaultValue="Realistic YouTube Presenter" />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text-main">Default clothing</label>
              <Textarea name="defaultClothingDescription" rows={3} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text-main">Default studio</label>
              <Textarea name="defaultStudioDescription" rows={4} defaultValue="Premium dark navy technology studio with cyan and purple neon lighting, realistic desk, glossy reflections and cinematic depth of field." />
            </div>
            <Input className="sm:col-span-2" name="defaultCallToAction" label="Default call to action" />
            {[
              ["frontImage", "Front-facing image *"],
              ["leftAngleImage", "Left-angle image"],
              ["rightAngleImage", "Right-angle image"],
              ["fullBodyImage", "Full-body image"],
              ["channelLogo", "Channel logo"],
            ].map(([name, label]) => (
              <label key={name} className="flex flex-col gap-1.5 text-sm font-medium text-text-main">
                {label}
                <input name={name} type="file" accept="image/png,image/jpeg,image/webp" required={name === "frontImage"} className="rounded-control border border-border bg-surface p-2 text-sm" />
              </label>
            ))}
            {error && <p className="sm:col-span-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
            <Button className="sm:col-span-2" type="submit" loading={saving} icon="person_add">Save Avatar Profile</Button>
          </form>
        </Card>

        <Card title="Saved avatars" subtitle={`${profiles.length} profile${profiles.length === 1 ? "" : "s"}`}>
          <div className="space-y-3">
            {profiles.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">No avatars saved.</p>}
            {profiles.map((profile) => {
              const front = profile.assets.find((asset) => asset.assetRole === "FRONT");
              return (
                <div key={profile.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  {front ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/avatar-assets/${front.id}`} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <span className="material-symbols-outlined grid h-16 w-16 place-items-center rounded-lg bg-bg text-3xl text-text-muted">person</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-main">{profile.name}</p>
                    <p className="truncate text-xs text-text-muted">{profile.accent} · {profile.assets.length} assets</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void remove(profile)}>Delete</Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
