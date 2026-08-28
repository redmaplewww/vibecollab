import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { buildGithubProgressReport, renderGithubProgressMarkdown } from "../scripts/github-report.mjs";
import { installRepositoryFiles } from "../scripts/install.mjs";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

function configureGit(root, name) {
  git(root, "config", "user.name", name);
  git(root, "config", "user.email", `${name.toLowerCase()}@example.test`);
}

function taskPath(root) {
  return resolve(root, ".ai-team/tasks/TASK-000-define-first-task/TASK.md");
}

function replace(root, replacements) {
  const path = taskPath(root);
  let content = readFileSync(path, "utf8");
  for (const [from, to] of replacements) {
    assert.ok(content.includes(from), `Missing fixture text: ${from}`);
    content = content.replace(from, to);
  }
  writeFileSync(path, content, "utf8");
}

test("GitHub summary unifies same-task handoff, functional progress, and contributor commits", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-github-report-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Maintainer");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");
    const base = git(root, "rev-parse", "HEAD");

    configureGit(root, "Alice");
    mkdirSync(resolve(root, "src"));
    writeFileSync(resolve(root, "src/agent.js"), "export function run() { return 'foundation'; }\n", "utf8");
    replace(root, [
      ["- Title: `Define the first shared task`", "- Title: `Build shared agent`"],
      ["- Revision: `0`", "- Revision: `1`"],
      ["- Status: `planning`", "- Status: `handoff`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["- Next owner: `unassigned`", "- Next owner: `bob`"],
      ["- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.", "- [x] Given a request, when the agent runs, then it returns the stable foundation result."],
      ["- Nothing completed yet.", "- Alice implemented the stable agent entry point."],
      ["- Define the task contract before implementation.", "- Bob adds routing without changing the entry-point contract."],
      ["- From: `unassigned`", "- From: `alice`"],
      ["- To: `unassigned`", "- To: `bob`"],
      ["- Summary: No handoff has occurred.", "- Summary: Foundation is committed; Bob continues routing."],
    ]);
    git(root, "add", ".");
    git(root, "commit", "-m", "feat: add agent foundation");

    configureGit(root, "Bob");
    writeFileSync(
      resolve(root, "src/agent.js"),
      "export function run(input) { return input === 'tool' ? 'routed' : 'foundation'; }\n",
      "utf8",
    );
    replace(root, [
      ["- Revision: `1`", "- Revision: `2`"],
      ["- Status: `handoff`", "- Status: `active`"],
      ["- Owner: `alice`", "- Owner: `bob`"],
      ["- Next owner: `bob`", "- Next owner: `unassigned`"],
      ["- Bob adds routing without changing the entry-point contract.", "- Add project-level tests, then mark verification complete."],
      ["- Alice implemented the stable agent entry point.", "- Alice implemented the stable entry point; Bob added tool routing."],
    ]);
    git(root, "add", ".");
    git(root, "commit", "-m", "feat: add tool routing");

    const report = buildGithubProgressReport({
      root,
      base,
      github: {
        GITHUB_ACTOR: "bob-gh",
        GITHUB_REPOSITORY: "team/shared-agent",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REF_NAME: "task/TASK-000-agent",
        GITHUB_SHA: git(root, "rev-parse", "HEAD"),
      },
    });
    assert.equal(report.valid, true, report.errors.join("\n"));
    assert.equal(report.github.actor, "bob-gh");
    assert.equal(report.tasks[0].title, "Build shared agent");
    assert.equal(report.tasks[0].acceptance.percent, 100);
    assert.equal(report.git.commits, 2);
    assert.ok(report.contributors.some((entry) => entry.author === "Alice" && entry.commits === 1));
    assert.ok(report.contributors.some((entry) => entry.author === "Bob" && entry.commits === 1));

    const markdown = renderGithubProgressMarkdown(report);
    assert.match(markdown, /功能进度/);
    assert.match(markdown, /Build shared agent/);
    assert.match(markdown, /Alice/);
    assert.match(markdown, /Bob/);
    assert.match(markdown, /无法推断未提交工作或真实专注工时/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installed workflow is read-only, automatic, and has no service credentials", () => {
  const workflow = readFileSync(resolve("templates/repository/.github/workflows/repo-task-sync.yml"), "utf8");
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /github-report\.mjs/);
  assert.doesNotMatch(workflow, /Bearer|secret|token|connect|outbox|docker|monitor/i);
});

test("distributed daily workflow contains no session or local activity collector", () => {
  const files = [
    "README.md",
    "AGENTS.md",
    "skills/repo-task-sync/SKILL.md",
    "templates/repository/AGENTS.md",
    "templates/repository/.ai-team/PROJECT.md",
    "templates/repository/.github/PULL_REQUEST_TEMPLATE/repo-task-sync.md",
  ];
  const content = files.map((path) => readFileSync(resolve(path), "utf8")).join("\n");
  assert.doesNotMatch(content, /session-policy|session\.mjs|\.codex\/hooks|Bearer Token|Outbox|Docker Compose/i);
  assert.doesNotMatch(content, /session-policy|session\.mjs|\.codex\/hooks|transcript_path|token_count/i);
});
