#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = resolve(packageRoot, "templates/repository");
const privateSessionTemplateRoot = resolve(packageRoot, "templates/private-session");
const START = "<!-- repo-task-sync:start -->";
const END = "<!-- repo-task-sync:end -->";
const UPGRADEABLE = new Set([
  ".ai-team/SKILL.md",
  ".ai-team/check.mjs",
  ".ai-team/session.mjs",
  ".ai-team/task-store.mjs",
  ".codex/hooks.json",
  ".github/PULL_REQUEST_TEMPLATE/repo-task-sync.md",
  ".github/workflows/repo-task-sync.yml",
]);
const PRESERVE_ON_UPGRADE = new Set([".ai-team/PROJECT.md"]);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function parseArgs(argv) {
  let target = null;
  let dryRun = false;
  let privateSessions = false;
  let upgrade = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--target") target = argv[++index];
    else if (argv[index] === "--dry-run") dryRun = true;
    else if (argv[index] === "--private-sessions") privateSessions = true;
    else if (argv[index] === "--upgrade") upgrade = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!target) {
    throw new Error(
      "Usage: node scripts/install.mjs --target <repository> [--private-sessions] [--upgrade] [--dry-run]",
    );
  }
  return { target: resolve(target), dryRun, privateSessions, upgrade };
}

export function installRepositoryFiles({ target, dryRun = false, privateSessions = false, upgrade = false }) {
  const targetRoot = resolve(target);
  if (!existsSync(targetRoot) || !statSync(targetRoot).isDirectory()) {
    throw new Error(`Target directory does not exist: ${targetRoot}`);
  }

  let mappings = listFiles(templateRoot).map((source) => ({
    source,
    destination: resolve(targetRoot, relative(templateRoot, source)),
  }));
  const existingTasksRoot = resolve(targetRoot, ".ai-team/tasks");
  const hasTaskDirectory =
    existsSync(existingTasksRoot) && listFiles(existingTasksRoot).some((path) => path.endsWith("TASK.md"));
  if (hasTaskDirectory || existsSync(resolve(targetRoot, ".ai-team/TASK.md"))) {
    mappings = mappings.filter(
      (mapping) =>
        relative(targetRoot, mapping.destination).replaceAll("\\", "/") !==
        ".ai-team/tasks/TASK-000-define-first-task/TASK.md",
    );
  }
  if (privateSessions) {
    mappings.push(
      ...listFiles(privateSessionTemplateRoot).map((source) => ({
        source,
        destination: resolve(targetRoot, relative(privateSessionTemplateRoot, source)),
      })),
    );
  }
  mappings.push(
    { source: resolve(packageRoot, "skills/repo-task-sync/SKILL.md"), destination: resolve(targetRoot, ".ai-team/SKILL.md") },
    { source: resolve(packageRoot, "scripts/check.mjs"), destination: resolve(targetRoot, ".ai-team/check.mjs") },
    { source: resolve(packageRoot, "scripts/session.mjs"), destination: resolve(targetRoot, ".ai-team/session.mjs") },
    { source: resolve(packageRoot, "scripts/task-store.mjs"), destination: resolve(targetRoot, ".ai-team/task-store.mjs") },
  );

  const conflicts = [];
  for (const mapping of mappings) {
    if (mapping.destination === resolve(targetRoot, "AGENTS.md")) continue;
    if (existsSync(mapping.destination)) {
      const existing = readFileSync(mapping.destination, "utf8");
      const incoming = readFileSync(mapping.source, "utf8");
      const destinationName = relative(targetRoot, mapping.destination).replaceAll("\\", "/");
      if (
        existing !== incoming &&
        !(upgrade && (UPGRADEABLE.has(destinationName) || PRESERVE_ON_UPGRADE.has(destinationName)))
      ) {
        conflicts.push(destinationName);
      }
    }
  }
  if (conflicts.length) {
    throw new Error(`Installation stopped; existing files would be overwritten:\n- ${conflicts.join("\n- ")}`);
  }

  const created = [];
  const unchanged = [];
  const appended = [];
  const updated = [];
  for (const mapping of mappings) {
    const destinationName = relative(targetRoot, mapping.destination).replaceAll("\\", "/");
    const incoming = readFileSync(mapping.source, "utf8");
    if (destinationName === "AGENTS.md" && existsSync(mapping.destination)) {
      const existing = readFileSync(mapping.destination, "utf8");
      if (existing.includes(START) && existing.includes(END)) {
        if (upgrade) {
          const before = existing.slice(0, existing.indexOf(START));
          const after = existing.slice(existing.indexOf(END) + END.length);
          const replacement = `${before.trimEnd()}\n\n${incoming.trim()}${after}`;
          if (!dryRun) writeFileSync(mapping.destination, replacement, "utf8");
          updated.push(destinationName);
        } else {
          unchanged.push(destinationName);
        }
      } else {
        if (!dryRun) writeFileSync(mapping.destination, `${existing.trimEnd()}\n\n${incoming}`, "utf8");
        appended.push(destinationName);
      }
      continue;
    }
    if (existsSync(mapping.destination)) {
      if (upgrade && UPGRADEABLE.has(destinationName)) {
        if (!dryRun) writeFileSync(mapping.destination, incoming, "utf8");
        updated.push(destinationName);
        continue;
      }
      unchanged.push(destinationName);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(mapping.destination), { recursive: true });
      writeFileSync(mapping.destination, incoming, "utf8");
    }
    created.push(destinationName);
  }

  return { valid: true, target: targetRoot, dryRun, privateSessions, upgrade, created, appended, updated, unchanged };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = installRepositoryFiles(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
