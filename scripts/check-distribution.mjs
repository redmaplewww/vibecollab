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
  const canonicalSession = readFileSync(resolve("scripts/session.mjs"), "utf8");
  const installedSession = readFileSync(resolve(target, ".ai-team/session.mjs"), "utf8");
  if (canonicalSession !== installedSession) throw new Error("Installed session recorder differs from canonical source");

  const privateTarget = mkdtempSync(resolve(tmpdir(), "vibecollab-private-dist-"));
  try {
    installRepositoryFiles({ target: privateTarget, privateSessions: true });
    const privateResult = validateRepository({ root: privateTarget });
    if (!privateResult.valid) throw new Error(privateResult.errors.join("\n"));
  } finally {
    rmSync(privateTarget, { recursive: true, force: true });
  }
  process.stdout.write("Distribution check passed\n");
} finally {
  rmSync(target, { recursive: true, force: true });
}
