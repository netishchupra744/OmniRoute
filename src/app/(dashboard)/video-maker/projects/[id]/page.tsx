import { notFound } from "next/navigation";
import ProjectDetailClient from "@/features/videoMaker/ProjectDetailClient";
import { getVideoProject } from "@/lib/db/videoProjects";
import { getCurrentMasterPrompt, listProjectScenes } from "@/lib/db/videoProjectPlans";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params;
  const project = getVideoProject(id);
  if (!project) notFound();
  return <ProjectDetailClient initialProject={project} initialScenes={listProjectScenes(id)} masterPrompt={getCurrentMasterPrompt(id)} />;
}
