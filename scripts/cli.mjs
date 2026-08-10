#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installRepositoryFiles } from "./install.mjs";
import { validateRepository } from "./check.mjs";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function parseArgs(argv) {
  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
  const options = {
    command,
    target: process.cwd(),
    privateSessions: false,
    dryRun: false,
    json: false,
    base: null,
  };
  const start = command === "help" && (!argv[0] || argv[0].startsWith("-")) ? 0 : 1;
  for (let index = start; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--target" || value === "--root") options.target = resolve(argv[++index]);
    else if (value === "--private" || value === "--private-sessions") options.privateSessions = true;
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--json") options.json = true;
    else if (value === "--base") options.base = argv[++index];
    else if (value === "--help" || value === "-h") options.command = "help";
    else if (value === "--version" || value === "-v") options.command = "version";
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function repositoryRoot(target) {
  const root = git(resolve(target), ["rev-parse", "--show-toplevel"]);
  if (!root) throw new Error(`VibeCollab must run inside a Git repository: ${resolve(target)}`);
  return resolve(root);
}

function identity(root) {
  return git(root, ["config", "user.name"]) || git(root, ["config", "user.email"]);
}

function packageVersion() {
  const path = resolve(fileURLToPath(new URL("..", import.meta.url)), "package.json");
  return JSON.parse(readFileSync(path, "utf8")).version;
}

function setup(options) {
  const root = repositoryRoot(options.target);
  const installation = installRepositoryFiles({
    target: root,
    dryRun: options.dryRun,
    privateSessions: options.privateSessions,
  });
  const validation = options.dryRun ? null : validateRepository({ root });
  const actor = identity(root);
  return {
    ok: options.dryRun || Boolean(validation?.valid),
    command: "setup",
    root,
    version: packageVersion(),
    actor: actor || "unavailable",
    privateSessions: options.privateSessions,
    installation,
    validation,
    nextActions: [
      ...(actor ? [] : ["Set this repository's Git identity: git config user.name \"Your Name\""]),
      ...(options.privateSessions ? ["Open Codex in this repository and trust the project Hook once"] : []),
      "Commit the generated collaboration files and share them through your normal pull request",
      "Work normally; no manual session start or stop is required",
    ],
  };
}

function doctor(options) {
  const root = repositoryRoot(options.target);
  const validation = validateRepository({ root, base: options.base });
  const actor = identity(root);
  const hooksInstalled = existsSync(resolve(root, ".codex/hooks.json"));
  return {
    ok: validation.valid && Boolean(actor),
    command: "doctor",
    root,
    actor: actor || "unavailable",
    checks: {
      gitRepository: true,
      gitIdentity: Boolean(actor),
      collaborationFiles: validation.valid,
      privateHook: hooksInstalled,
      privateSessions: validation.sessions.enabled,
    },
    validation,
    actions: [
      ...(actor ? [] : ["Run: git config user.name \"Your Name\""]),
      ...(!validation.valid ? validation.errors : []),
    ],
  };
}

function report(options) {
  const root = repositoryRoot(options.target);
  const validation = validateRepository({ root, base: options.base });
  return {
    ok: validation.valid,
    command: "report",
    root,
    task: validation.task,
    git: validation.git,
    sessions: validation.sessions,
    errors: validation.errors,
  };
}

function printHuman(result) {
  if (result.command === "setup") {
    process.stdout.write(
      [
        `VibeCollab ${result.version} is ready in ${result.root}`,
        `Private session journal: ${result.privateSessions ? "enabled" : "disabled"}`,
        `Actor: ${result.actor}`,
        `Created ${result.installation.created.length}; appended ${result.installation.appended.length}; unchanged ${result.installation.unchanged.length}`,
        ...result.nextActions.map((action, index) => `${index + 1}. ${action}`),
      ].join("\n") + "\n",
    );
    return;
  }
  if (result.command === "doctor") {
    const checks = Object.entries(result.checks).map(([name, passed]) => `${passed ? "[ok]" : "[!]"} ${name}`);
    process.stdout.write(
      [`VibeCollab doctor: ${result.ok ? "ready" : "needs attention"}`, `Repository: ${result.root}`, `Actor: ${result.actor}`, ...checks, ...result.actions.map((action) => `- ${action}`)].join("\n") + "\n",
    );
    return;
  }
  const task = result.task;
  const sessions = result.sessions.totals;
  process.stdout.write(
    [
      `Task ${task.id ?? "unavailable"}: ${task.title ?? "unavailable"}`,
      `Function progress: ${task.acceptance.completed}/${task.acceptance.total}${task.acceptance.percent === null ? "" : ` (${task.acceptance.percent}%)`}`,
      result.git.available
        ? `Code progress: ${result.git.commits} commits, ${result.git.changedFiles} files, +${result.git.additions}/-${result.git.deletions}`
        : "Code progress: add --base <branch-or-sha> for a Git comparison",
      `Sessions: ${sessions.sessions}; elapsed: ${sessions.elapsedSeconds}s; Token coverage: ${sessions.tokenCoverage.reported}/${sessions.tokenCoverage.total}`,
      `Result: ${result.ok ? "valid" : "blocked"}`,
      ...result.errors.map((error) => `- ${error}`),
    ].join("\n") + "\n",
  );
}

function help() {
  return [
    "VibeCollab — file-only collaboration for AI coding teams",
    "",
    "Usage:",
    "  vibecollab setup --private       Install in the current private Git repository",
    "  vibecollab doctor                Check identity, files, Hook and policy",
    "  vibecollab report [--base main]  Show function, code and session progress",
    "",
    "Options: --target <path> --json --dry-run --private --base <ref>",
  ].join("\n");
}

export function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    process.stdout.write(`${help()}\n`);
    return { ok: true, command: "help" };
  }
  if (options.command === "version") {
    process.stdout.write(`${packageVersion()}\n`);
    return { ok: true, command: "version" };
  }
  if (!new Set(["setup", "doctor", "report"]).has(options.command)) {
    throw new Error(`Unknown command: ${options.command}\n\n${help()}`);
  }
  const result = options.command === "setup" ? setup(options) : options.command === "doctor" ? doctor(options) : report(options);
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else printHuman(result);
  if (!result.ok) process.exitCode = 1;
  return result;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
