import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildCollaborationOverview } from "./collaboration-monitor";
import type { RegisteredProject } from "./project-registry";

export function buildProjectOverview(project: RegisteredProject) {
  if (!existsSync(project.root)) throw new Error(`Project root does not exist: ${project.id}`);
  if (!existsSync(join(project.root, ".project-to-act")))
    throw new Error(`Project is not initialized with Project-to-Act: ${project.id}`);
  return buildCollaborationOverview(project.root);
}
