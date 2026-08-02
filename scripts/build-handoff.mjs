import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const version = String(packageJson.version);
const packageName = `VibeCollab-v${version}`;
const artifactsRoot = resolve(projectRoot, "artifacts");
const outputRoot = resolve(artifactsRoot, `${packageName}-handoff`);

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function artifact(path) {
  return { file: basename(path), bytes: statSync(path).size, sha256: sha256(path) };
}

const dirty = git(["status", "--porcelain=v1", "--untracked-files=all"]);
if (dirty) {
  throw new Error("Refusing to build a handoff package from a dirty worktree. Commit or remove pending changes first.");
}

const commit = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const sourceZip = resolve(outputRoot, `${packageName}-source.zip`);
const bundle = resolve(outputRoot, `${packageName}.bundle`);
const handoffCopy = resolve(outputRoot, "README-HANDOFF.md");
const manifestPath = resolve(outputRoot, "PACKAGE-MANIFEST.json");
const checksumsPath = resolve(outputRoot, "SHA256SUMS.txt");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

git(["archive", "--format=zip", `--prefix=${packageName}/`, `--output=${sourceZip}`, "HEAD"]);
git(["bundle", "create", bundle, "--all"]);
git(["bundle", "verify", bundle]);
copyFileSync(resolve(projectRoot, "docs", "HANDOFF.md"), handoffCopy);

const coreArtifacts = [sourceZip, bundle, handoffCopy].map(artifact);
const manifest = {
  schemaVersion: 1,
  package: "VibeCollab handoff",
  version,
  commit,
  branch,
  generatedAt: new Date().toISOString(),
  requirements: { node: ">=20", packageManager: "npm", git: true },
  artifacts: coreArtifacts,
  restore: {
    bundle: `git clone ${basename(bundle)} VibeCollab`,
    source: `Expand-Archive ${basename(sourceZip)} -DestinationPath restored`,
    verify: "npm ci && npm run verify",
  },
  exclusions: [
    ".git",
    "node_modules",
    ".next",
    "coverage",
    "artifacts",
    "vibecollab.config.local.json",
    ".env.local",
    ".project-to-act/runtime",
  ],
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const checksumArtifacts = [...coreArtifacts, artifact(manifestPath)];
writeFileSync(checksumsPath, `${checksumArtifacts.map((item) => `${item.sha256}  ${item.file}`).join("\n")}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      outputRoot,
      version,
      commit,
      branch,
      artifacts: [...checksumArtifacts, artifact(checksumsPath)],
    },
    null,
    2,
  )}\n`,
);
