#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = resolve(packageRoot, "templates/repository");
const privateSessionTemplateRoot = resolve(packageRoot, "templates/private-session");
const START = "<!-- repo-task-sync:start -->";
const END = "<!-- repo-task-sync:end -->";

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
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--target") target = argv[++index];
    else if (argv[index] === "--dry-run") dryRun = true;
    else if (argv[index] === "--private-sessions") privateSessions = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!target) {
    throw new Error(
      "Usage: node scripts/install.mjs --target <repository> [--private-sessions] [--dry-run]",
    );
  }
  return { target: resolve(target), dryRun, privateSessions };
}

export function installRepositoryFiles({ target, dryRun = false, privateSessions = false }) {
  const targetRoot = resolve(target);
  if (!existsSync(targetRoot) || !statSync(targetRoot).isDirectory()) {
    throw new Error(`Target directory does not exist: ${targetRoot}`);
  }

  const mappings = listFiles(templateRoot).map((source) => ({
    source,
    destination: resolve(targetRoot, relative(templateRoot, source)),
  }));
  if (privateSessions) {
    mappings.push(
      ...listFiles(privateSessionTemplateRoot).map((source) => {
        const templatePath = relative(privateSessionTemplateRoot, source).replaceAll("\\", "/");
        return {
          source,
          destination: resolve(targetRoot, templatePath === ".ai-team/gitignore.template" ? ".ai-team/.gitignore" : templatePath),
        };
      }),
    );
  }
  mappings.push(
    { source: resolve(packageRoot, "skills/repo-task-sync/SKILL.md"), destination: resolve(targetRoot, ".ai-team/SKILL.md") },
    { source: resolve(packageRoot, "scripts/check.mjs"), destination: resolve(targetRoot, ".ai-team/check.mjs") },
    { source: resolve(packageRoot, "scripts/session.mjs"), destination: resolve(targetRoot, ".ai-team/session.mjs") },
  );

  const conflicts = [];
  for (const mapping of mappings) {
    if (mapping.destination === resolve(targetRoot, "AGENTS.md")) continue;
    if (existsSync(mapping.destination)) {
      const existing = readFileSync(mapping.destination, "utf8");
      const incoming = readFileSync(mapping.source, "utf8");
      if (existing !== incoming) conflicts.push(relative(targetRoot, mapping.destination).replaceAll("\\", "/"));
    }
  }
  if (conflicts.length) {
    throw new Error(`Installation stopped; existing files would be overwritten:\n- ${conflicts.join("\n- ")}`);
  }

  const created = [];
  const unchanged = [];
  const appended = [];
  for (const mapping of mappings) {
    const destinationName = relative(targetRoot, mapping.destination).replaceAll("\\", "/");
    const incoming = readFileSync(mapping.source, "utf8");
    if (destinationName === "AGENTS.md" && existsSync(mapping.destination)) {
      const existing = readFileSync(mapping.destination, "utf8");
      if (existing.includes(START) && existing.includes(END)) {
        unchanged.push(destinationName);
      } else {
        if (!dryRun) writeFileSync(mapping.destination, `${existing.trimEnd()}\n\n${incoming}`, "utf8");
        appended.push(destinationName);
      }
      continue;
    }
    if (existsSync(mapping.destination)) {
      unchanged.push(destinationName);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(mapping.destination), { recursive: true });
      writeFileSync(mapping.destination, incoming, "utf8");
    }
    created.push(destinationName);
  }

  return { valid: true, target: targetRoot, dryRun, privateSessions, created, appended, unchanged };
}

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : null;
if (invokedPath === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const result = installRepositoryFiles(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
