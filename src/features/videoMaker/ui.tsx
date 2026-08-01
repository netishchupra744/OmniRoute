"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/shared/components";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function OfflineGenerationBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
      Offline — AI generation requires an internet connection.
    </div>
  );
}

export function VideoMakerPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <OfflineGenerationBanner />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const variant =
    status === "COMPLETED" || status === "PLAN_READY" || status === "READY_TO_RENDER"
      ? "success"
      : status === "FAILED" || status === "CANCELLED"
        ? "error"
        : status === "PLANNING" || status === "GENERATING" || status === "RENDERING"
          ? "warning"
          : "default";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}

export function EmptyProjects() {
  return (
    <div className="rounded-card border border-dashed border-border p-10 text-center">
      <span className="material-symbols-outlined text-5xl text-text-muted">movie_edit</span>
      <h2 className="mt-3 font-semibold text-text-main">No video projects yet</h2>
      <p className="mt-1 text-sm text-text-muted">Create a 33-scene, 5-minute-30-second project.</p>
      <Link
        href="/video-maker/new"
        className="mt-5 inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-white"
      >
        Create New Video
      </Link>
    </div>
  );
}
