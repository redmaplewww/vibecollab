import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

const projectSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/u),
  name: z.string().min(1).max(100),
  root: z.string().min(1),
});

const registrySchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.array(projectSchema).min(1),
});

export type RegisteredProject = z.infer<typeof projectSchema> & { root: string };

function registryPath() {
  const root = process.cwd();
  const local = resolve(root, "vibecollab.config.local.json");
  return existsSync(local) ? local : resolve(root, "vibecollab.config.json");
}

export function listProjects(): RegisteredProject[] {
  const path = registryPath();
  const parsed = registrySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const ids = new Set<string>();
  return parsed.projects.map((project) => {
    if (ids.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
    ids.add(project.id);
    const root = isAbsolute(project.root) ? resolve(project.root) : resolve(dirname(path), project.root);
    return { ...project, root };
  });
}

export function getProject(id: string) {
  return listProjects().find((project) => project.id === id) ?? null;
}
