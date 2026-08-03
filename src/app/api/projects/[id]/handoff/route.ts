import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hasApiAccess } from "@/lib/access";
import { runHandoffAction } from "@/lib/handoff-action";
import { getProject } from "@/lib/project-registry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasApiAccess(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const project = getProject((await params).id);
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  try {
    const result = runHandoffAction(project, await request.json());
    return NextResponse.json({ data: result, meta: { projectId: project.id, actionBoundary: "sequential-handoff" } });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "invalid_request", issues: error.issues }, { status: 400 });
    return NextResponse.json(
      { error: "handoff_rejected", message: error instanceof Error ? error.message : "Unknown handoff error" },
      { status: 409 },
    );
  }
}
