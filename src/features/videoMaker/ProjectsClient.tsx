"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Select } from "@/shared/components";
import { EmptyProjects, ProjectStatusBadge, VideoMakerPageHeader } from "./ui";

interface ProjectItem {
  id: string;
  name: string;
  videoTitle: string;
  status: string;
  updatedAt: string;
  lastErrorMessage: string | null;
}

export default function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const response = await fetch(`/api/video-projects?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Projects could not be loaded.");
      setProjects(payload.projects || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Projects could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Initial load only; filter uses the Search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(project: ProjectItem) {
    if (!window.confirm(`Delete “${project.name}” and all project-owned records?`)) return;
    const response = await fetch(`/api/video-projects/${project.id}`, { method: "DELETE" });
    if (response.ok) setProjects((current) => current.filter((item) => item.id !== project.id));
  }

  async function rename(project: ProjectItem) {
    const name = window.prompt("New project name", project.name)?.trim();
    if (!name || name === project.name) return;
    setError("");
    const response = await fetch(`/api/video-projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Project could not be renamed.");
      return;
    }
    setProjects((current) => current.map((item) => item.id === project.id ? payload.project : item));
  }

  async function duplicate(project: ProjectItem) {
    setError("");
    const response = await fetch(`/api/video-projects/${project.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Project could not be duplicated.");
      return;
    }
    setProjects((current) => [payload.project, ...current]);
  }

  return (
    <div className="space-y-6">
      <VideoMakerPageHeader
        title="My Projects"
        description="Search, resume and manage persistent Bijoy AI video projects."
        action={
          <Link href="/video-maker/new" className="inline-flex h-10 items-center rounded-control bg-accent px-5 text-sm font-semibold text-white">
            New Video
          </Link>
        }
      />
      <Card padding="sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <Input placeholder="Search name or title" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "PLANNING", label: "Planning" },
              { value: "PLAN_READY", label: "Plan ready" },
              { value: "GENERATING", label: "Generating" },
              { value: "READY_TO_RENDER", label: "Ready to render" },
              { value: "RENDERING", label: "Rendering" },
              { value: "COMPLETED", label: "Completed" },
              { value: "FAILED", label: "Failed" },
            ]}
            placeholder="All statuses"
          />
          <Button variant="secondary" onClick={() => void load()} loading={loading}>Search</Button>
        </div>
      </Card>
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {!loading && projects.length === 0 ? (
        <EmptyProjects />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} hover>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-text-main">{project.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-text-muted">{project.videoTitle}</p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
              {project.lastErrorMessage && <p className="mt-3 line-clamp-2 text-xs text-red-500">{project.lastErrorMessage}</p>}
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted">Updated {new Date(project.updatedAt).toLocaleString()}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void rename(project)}>Rename</Button>
                  <Button variant="ghost" size="sm" onClick={() => void duplicate(project)}>Duplicate</Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(project)}>Delete</Button>
                  <Link href={`/video-maker/projects/${project.id}`} className="inline-flex h-7 items-center rounded-control bg-accent px-3 text-xs font-medium text-white">Open</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
