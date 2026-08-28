import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { installRepositoryFiles } from "../scripts/install.mjs";
import { validateRepository } from "../scripts/check.mjs";
import { createTask } from "../scripts/task-store.mjs";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

function configureGit(root, name) {
  git(root, "config", "user.name", name);
  git(root, "config", "user.email", `${name.toLowerCase()}@example.test`);
}

function taskPath(root, id = "TASK-000") {
  const tasksRoot = resolve(root, ".ai-team/tasks");
  const directory = execFileSync(
    process.execPath,
    ["-e", `const fs=require('fs');process.stdout.write(fs.readdirSync(${JSON.stringify(tasksRoot)}).find(x=>x.startsWith(${JSON.stringify(`${id}-`)}))||'')`],
    { encoding: "utf8" },
  );
  return resolve(tasksRoot, directory, "TASK.md");
}

function replaceTask(root, replacements, id = "TASK-000") {
  const path = taskPath(root, id);
  let content = readFileSync(path, "utf8");
  for (const [from, to] of replacements) {
    assert.ok(content.includes(from), `Missing task fixture text: ${from}`);
    content = content.replace(from, to);
  }
  writeFileSync(path, content, "utf8");
}

test("maintainer installation creates the GitHub-native package without a second runtime", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-install-"));
  try {
    writeFileSync(resolve(root, "AGENTS.md"), "# Existing rules\n", "utf8");
    const result = installRepositoryFiles({ target: root });
    assert.equal(result.valid, true);
    assert.ok(result.created.includes(".ai-team/github-report.mjs"));
    assert.ok(result.created.includes(".github/workflows/repo-task-sync.yml"));
    assert.match(readFileSync(resolve(root, "AGENTS.md"), "utf8"), /repo-task-sync:start/);
    assert.equal(existsSync(resolve(root, ".ai-team/session.mjs")), false);
    assert.equal(existsSync(resolve(root, ".codex/hooks.json")), false);
    assert.equal(validateRepository({ root, allTasks: true }).valid, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("upgrade refreshes managed runtime and preserves project and task facts", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-upgrade-"));
  try {
    installRepositoryFiles({ target: root });
    const project = resolve(root, ".ai-team/PROJECT.md");
    const task = taskPath(root);
    writeFileSync(project, "# Team project facts\n", "utf8");
    const taskFacts = readFileSync(task, "utf8").replace("Nothing completed yet.", "Existing durable result.");
    writeFileSync(task, taskFacts, "utf8");
    writeFileSync(resolve(root, ".ai-team/github-report.mjs"), "outdated\n", "utf8");
    writeFileSync(resolve(root, ".ai-team/session.mjs"), "retired runtime\n", "utf8");
    writeFileSync(resolve(root, ".ai-team/session-policy.json"), "{}\n", "utf8");
    mkdirSync(resolve(root, ".codex"));
    writeFileSync(resolve(root, ".codex/hooks.json"), "{}\n", "utf8");
    mkdirSync(resolve(root, ".ai-team/sessions"));
    writeFileSync(resolve(root, ".ai-team/sessions/history.md"), "preserve historical evidence\n", "utf8");

    const result = installRepositoryFiles({ target: root, upgrade: true });
    assert.ok(result.updated.includes(".ai-team/github-report.mjs"));
    assert.equal(readFileSync(project, "utf8"), "# Team project facts\n");
    assert.equal(readFileSync(task, "utf8"), taskFacts);
    assert.deepEqual(result.removed.sort(), [".ai-team/session-policy.json", ".ai-team/session.mjs", ".codex/hooks.json"]);
    assert.equal(existsSync(resolve(root, ".ai-team/session.mjs")), false);
    assert.equal(existsSync(resolve(root, ".codex/hooks.json")), false);
    assert.equal(readFileSync(resolve(root, ".ai-team/sessions/history.md"), "utf8"), "preserve historical evidence\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("code changes require exactly one matching Task update", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-gate-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Maintainer");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");
    const base = git(root, "rev-parse", "HEAD");
    mkdirSync(resolve(root, "src"));
    writeFileSync(resolve(root, "src/agent.js"), "export const run = () => 'ok';\n", "utf8");
    assert.equal(validateRepository({ root, base }).valid, false);

    replaceTask(root, [
      ["- Revision: `0`", "- Revision: `1`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["- Status: `planning`", "- Status: `active`"],
      ["- Nothing completed yet.", "- Stable agent entry point implemented."],
    ]);
    const result = validateRepository({ root, base });
    assert.equal(result.valid, true, result.errors.join("\n"));
    assert.equal(result.task.id, "TASK-000");
    assert.ok(result.git.files.includes("src/agent.js"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("two contributors can develop separate Tasks without a shared mutable task", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-parallel-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Maintainer");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");

    createTask({ root, id: "AGENT-101", title: "Agent memory", owner: "alice" });
    createTask({ root, id: "AGENT-102", title: "Tool routing", owner: "bob" });
    assert.notEqual(taskPath(root, "AGENT-101"), taskPath(root, "AGENT-102"));
    const all = validateRepository({ root, allTasks: true });
    assert.equal(all.valid, true, all.errors.join("\n"));
    assert.ok(all.tasks.some((task) => task.id === "AGENT-101" && task.owner === "alice"));
    assert.ok(all.tasks.some((task) => task.id === "AGENT-102" && task.owner === "bob"));
    assert.equal(existsSync(resolve(root, ".ai-team/TASK.md")), false);
    const report = spawnSync(process.execPath, [resolve(root, ".ai-team/github-report.mjs")], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(report.status, 0, report.stderr || report.stdout);
    assert.match(report.stdout, /AGENT-101/);
    assert.match(report.stdout, /AGENT-102/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installed checker and reporter run with Node and Git only", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-runtime-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Alice");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");
    const check = spawnSync(process.execPath, [resolve(root, ".ai-team/check.mjs"), "--all", "--json"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).valid, true);
    const report = spawnSync(process.execPath, [resolve(root, ".ai-team/github-report.mjs")], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(report.status, 0, report.stderr || report.stdout);
    assert.match(report.stdout, /GitHub 原生进度/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("maintainer CLI setup has no private, token, or service step", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-cli-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Maintainer");
    const result = spawnSync(process.execPath, [resolve("scripts/cli.mjs"), "setup", "--target", root, "--json"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const setup = JSON.parse(result.stdout);
    assert.equal(setup.ok, true);
    assert.equal("privateSessions" in setup, false);
    assert.equal(existsSync(resolve(root, ".ai-team/github-report.mjs")), true);
    assert.doesNotMatch(result.stdout, /Bearer|Token|connect|Hook|Monitor/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
