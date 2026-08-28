import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { installRepositoryFiles } from "./install.mjs";
import { validateRepository } from "./check.mjs";

const target = mkdtempSync(resolve(tmpdir(), "vibecollab-dist-"));
try {
  installRepositoryFiles({ target });
  const result = validateRepository({ root: target });
  if (!result.valid) throw new Error(result.errors.join("\n"));
  const canonicalSkill = readFileSync(resolve("skills/repo-task-sync/SKILL.md"), "utf8");
  const installedSkill = readFileSync(resolve(target, ".ai-team/SKILL.md"), "utf8");
  if (canonicalSkill !== installedSkill) throw new Error("Installed Skill differs from the canonical Skill");
  const canonicalReport = readFileSync(resolve("scripts/github-report.mjs"), "utf8");
  const installedReport = readFileSync(resolve(target, ".ai-team/github-report.mjs"), "utf8");
  if (canonicalReport !== installedReport) throw new Error("Installed GitHub report differs from canonical source");
  const canonicalTaskStore = readFileSync(resolve("scripts/task-store.mjs"), "utf8");
  const installedTaskStore = readFileSync(resolve(target, ".ai-team/task-store.mjs"), "utf8");
  if (canonicalTaskStore !== installedTaskStore) throw new Error("Installed task store differs from canonical source");
  const packageMetadata = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  if (packageMetadata.bin?.vibecollab !== "scripts/cli.mjs") {
    throw new Error("Package does not expose the vibecollab CLI");
  }

  process.stdout.write("Distribution check passed\n");
} finally {
  rmSync(target, { recursive: true, force: true });
}
