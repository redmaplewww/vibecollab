import { notFound } from "next/navigation";
import { ProjectDashboard } from "@/components/project-dashboard";
import { requirePageAccess } from "@/lib/access";
import { buildProjectOverview } from "@/lib/project-overview";
import { getProject } from "@/lib/project-registry";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageAccess(`/projects/${id}`);
  const project = getProject(id);
  if (!project) notFound();
  return <ProjectDashboard project={project} overview={buildProjectOverview(project)} />;
}
