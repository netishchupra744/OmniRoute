import Link from "next/link";
import { Card } from "@/shared/components";
import type { DashboardVideoProjectStats } from "@/lib/db/videoProjects";
import { EmptyProjects, ProjectStatusBadge, VideoMakerPageHeader } from "./ui";

export default function DashboardView({ stats }: { stats: DashboardVideoProjectStats }) {
  const cards = [
    { label: "Projects", value: stats.totalProjects, icon: "video_library" },
    { label: "Active generations", value: stats.activeGenerations, icon: "progress_activity" },
    { label: "Failed scenes", value: stats.failedScenes, icon: "error" },
    { label: "Completed videos", value: stats.completedVideos, icon: "task_alt" },
  ];
  return (
    <div className="space-y-6">
      <VideoMakerPageHeader
        title="Bijoy AI Video Maker"
        description="Create a reusable Master Prompt, exactly 33 connected scenes, and a 5-minute-30-second YouTube video through connected API providers."
        action={
          <Link
            href="/video-maker/new"
            className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-white"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Video
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.label} padding="sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-text-main">{item.value}</p>
              </div>
              <span className="material-symbols-outlined rounded-xl bg-accent/10 p-3 text-2xl text-accent">
                {item.icon}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Recent projects" subtitle="Open a project to continue planning or generation.">
          {stats.recentProjects.length === 0 ? (
            <EmptyProjects />
          ) : (
            <div className="divide-y divide-border">
              {stats.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/video-maker/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-main">{project.name}</p>
                    <p className="mt-1 truncate text-xs text-text-muted">{project.videoTitle}</p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Usage summary" subtitle="Provider estimates are recorded only when available.">
          <p className="text-3xl font-bold text-text-main">${stats.estimatedCostUsd.toFixed(2)}</p>
          <p className="mt-1 text-sm text-text-muted">Estimated provider spending</p>
          <div className="mt-5 rounded-lg border border-border bg-bg p-4 text-sm text-text-muted">
            No private provider credentials are stored in project records or frontend logs.
          </div>
        </Card>
      </div>
    </div>
  );
}
