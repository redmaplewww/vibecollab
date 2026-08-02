import { NextResponse } from "next/server";
import { hasApiAccess } from "@/lib/access";
import { buildProjectOverview } from "@/lib/project-overview";
import { getProject } from "@/lib/project-registry";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasApiAccess(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const project = getProject((await params).id);
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  try {
    return NextResponse.json({
      data: buildProjectOverview(project),
      meta: { readOnly: true, projectId: project.id, metricsAreNotPerformanceScores: true },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "project_unavailable", message: error instanceof Error ? error.message : "Unknown project error" },
      { status: 503 },
    );
  }
}
