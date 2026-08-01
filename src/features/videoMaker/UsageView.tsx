import { Card } from "@/shared/components";
import type { DashboardVideoProjectStats } from "@/lib/db/videoProjects";
import { VideoMakerPageHeader } from "./ui";

export default function UsageView({ stats }: { stats: DashboardVideoProjectStats }) {
  return (
    <div className="space-y-6">
      <VideoMakerPageHeader title="Usage" description="Persistent provider usage and cost information. Values remain estimates unless an upstream provider reports actual cost." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-text-muted">Estimated provider spending</p><p className="mt-2 text-3xl font-bold text-text-main">${stats.estimatedCostUsd.toFixed(2)}</p></Card>
        <Card><p className="text-sm text-text-muted">Active generations</p><p className="mt-2 text-3xl font-bold text-text-main">{stats.activeGenerations}</p></Card>
        <Card><p className="text-sm text-text-muted">Failed scenes</p><p className="mt-2 text-3xl font-bold text-text-main">{stats.failedScenes}</p></Card>
      </div>
      <Card title="Cost reporting policy">
        <p className="max-w-3xl text-sm leading-6 text-text-muted">Bijoy AI Video Maker never presents guessed values as actual provider charges. Estimated and actual costs are stored separately, and unavailable costs remain empty.</p>
      </Card>
    </div>
  );
}
