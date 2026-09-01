import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { installRepositoryFiles } from "../scripts/install.mjs";
import { buildCanonicalTaskView, buildMigrationPreview, validateRepository } from "../scripts/check.mjs";
import { extractTokenUsageFromTranscript } from "../scripts/session.mjs";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

function configureGit(root, name) {
  git(root, "config", "user.name", name);
  git(root, "config", "user.email", `${name.toLowerCase()}@example.invalid`);
}

function replaceTask(root, replacements) {
  const path = resolve(root, ".ai-team/TASK.md");
  let task = readFileSync(path, "utf8");
  for (const [from, to] of replacements) task = task.replace(from, to);
  writeFileSync(path, task, "utf8");
}

test("installer creates a valid file-only collaboration package", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-install-"));
  try {
    const result = installRepositoryFiles({ target: root });
    assert.equal(result.valid, true);
    assert.ok(result.created.includes(".ai-team/TASK.md"));
    assert.ok(result.created.includes(".ai-team/check.mjs"));
    assert.ok(result.created.includes(".ai-team/session.mjs"));
    assert.equal(existsSync(resolve(root, ".ai-team/session-policy.json")), false);
    assert.equal(existsSync(resolve(root, ".codex/hooks.json")), false);
    assert.equal(validateRepository({ root }).valid, true);
    assert.equal(validateRepository({ root }).sessions.enabled, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installer preserves an existing AGENTS.md and refuses conflicting project facts", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-preserve-"));
  try {
    writeFileSync(resolve(root, "AGENTS.md"), "# Existing rules\n\nKeep this text.\n", "utf8");
    const result = installRepositoryFiles({ target: root });
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    assert.ok(result.appended.includes("AGENTS.md"));
    assert.match(agents, /Keep this text/);
    assert.match(agents, /repo-task-sync:start/);

    writeFileSync(resolve(root, ".ai-team/TASK.md"), "local facts\n", "utf8");
    assert.throws(
      () => installRepositoryFiles({ target: root }),
      /existing files would be overwritten:[\s\S]*\.ai-team\/TASK\.md/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator blocks code-only PRs and reports functional plus Git progress", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-check-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Alice");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");
    const base = git(root, "rev-parse", "HEAD");

    mkdirSync(resolve(root, "src"));
    writeFileSync(resolve(root, "src/agent.js"), "export const agent = true;\n", "utf8");
    git(root, "add", ".");
    git(root, "commit", "-m", "feat: add agent");
    const blocked = validateRepository({ root, base });
    assert.equal(blocked.valid, false);
    assert.match(blocked.errors.join("\n"), /without updating \.ai-team\/TASK\.md/);

    replaceTask(root, [
      ["- ID: `TASK-000`", "- ID: `AGENT-001`"],
      ["- Title: `Define the first shared task`", "- Title: `Build the agent foundation`"],
      ["- Status: `planning`", "- Status: `active`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.", "- [x] Given a request, when the agent runs, then it returns a typed result."],
    ]);
    git(root, "add", ".ai-team/TASK.md");
    git(root, "commit", "-m", "docs: sync task progress");

    const valid = validateRepository({ root, base });
    assert.equal(valid.valid, true);
    assert.deepEqual(valid.task.acceptance, { completed: 1, total: 1, percent: 100 });
    assert.equal(valid.git.commits, 2);
    assert.ok(valid.git.changedFiles >= 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator counts every acceptance scenario across multiple lines", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-multiline-acceptance-"));
  try {
    installRepositoryFiles({ target: root });
    replaceTask(root, [
      [
        "- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.",
        "- [x] First scenario.\n- [ ] Second scenario.",
      ],
    ]);

    const result = validateRepository({ root });
    assert.deepEqual(result.task.acceptance, { completed: 1, total: 2, percent: 50 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator blocks done tasks when a later acceptance scenario is unchecked", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-incomplete-acceptance-"));
  try {
    installRepositoryFiles({ target: root });
    replaceTask(root, [
      ["- Status: `planning`", "- Status: `done`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      [
        "- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.",
        "- [x] First scenario.\n- [ ] Second scenario.",
      ],
      ["- [ ] Replace with the repository's required check commands and results.", "- [x] Tests pass."],
    ]);

    const result = validateRepository({ root });
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /every acceptance scenario to be checked/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validator includes uncommitted and untracked local work", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-working-tree-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Alice");
    installRepositoryFiles({ target: root });
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install collaboration files");
    const base = git(root, "rev-parse", "HEAD");
    writeFileSync(resolve(root, "agent.js"), "export const value = 1;\n", "utf8");

    const blocked = validateRepository({ root, base });
    assert.equal(blocked.valid, false);
    assert.deepEqual(blocked.git.files, ["agent.js"]);

    replaceTask(root, [["- Nothing completed yet.", "- Began the agent implementation."]]);
    const valid = validateRepository({ root, base });
    assert.equal(valid.valid, true);
    assert.ok(valid.git.files.includes("agent.js"));
    assert.ok(valid.git.files.includes(".ai-team/TASK.md"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Alice PR merge gives Bob the same code and task context in another clone", () => {
  const sandbox = mkdtempSync(resolve(tmpdir(), "vibecollab-handoff-"));
  const remote = resolve(sandbox, "remote.git");
  const maintainer = resolve(sandbox, "maintainer");
  const alice = resolve(sandbox, "alice");
  const bob = resolve(sandbox, "bob");
  try {
    git(sandbox, "init", "--bare", remote);
    git(sandbox, "clone", remote, maintainer);
    configureGit(maintainer, "Maintainer");
    installRepositoryFiles({ target: maintainer });
    replaceTask(maintainer, [
      ["- ID: `TASK-000`", "- ID: `AGENT-001`"],
      ["- Title: `Define the first shared task`", "- Title: `Build one shared agent`"],
      ["- Status: `planning`", "- Status: `active`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
    ]);
    git(maintainer, "add", ".");
    git(maintainer, "commit", "-m", "chore: establish shared task");
    git(maintainer, "branch", "-M", "main");
    git(maintainer, "push", "-u", "origin", "main");
    git(remote, "symbolic-ref", "HEAD", "refs/heads/main");

    git(sandbox, "clone", remote, alice);
    git(sandbox, "clone", remote, bob);
    configureGit(alice, "Alice");
    configureGit(bob, "Bob");

    git(alice, "switch", "-c", "task/agent-001");
    mkdirSync(resolve(alice, "src"));
    writeFileSync(resolve(alice, "src/agent.js"), "export function run() { return 'foundation'; }\n", "utf8");
    replaceTask(alice, [
      ["- Status: `active`", "- Status: `handoff`"],
      ["- Next owner: `unassigned`", "- Next owner: `bob`"],
      ["- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.", "- [x] Given a request, when the foundation runs, then it returns a stable result."],
      ["- Record implementation decisions that the next developer must preserve.", "- Export one run function; Bob must preserve this public contract."],
      ["- Nothing completed yet.", "- Agent foundation and public run function."],
      ["- Define the task contract before implementation.", "- Add tool routing without changing the run export."],
      ["Fill this file, assign one owner, and open the first implementation PR.", "Implement tool routing behind the existing run function."],
      ["- From: `unassigned`", "- From: `alice`"],
      ["- To: `unassigned`", "- To: `bob`"],
      ["- Summary: No handoff has occurred.", "- Summary: Foundation merged; continue with tool routing."],
    ]);
    git(alice, "add", ".");
    git(alice, "commit", "-m", "feat: implement agent foundation");
    git(alice, "push", "-u", "origin", "task/agent-001");

    git(maintainer, "fetch", "origin");
    git(maintainer, "merge", "--no-ff", "origin/task/agent-001", "-m", "Merge pull request #1 from task/agent-001");
    git(maintainer, "push", "origin", "main");

    git(bob, "pull", "--ff-only", "origin", "main");
    const result = validateRepository({ root: bob });
    assert.equal(result.valid, true);
    assert.equal(result.task.status, "handoff");
    assert.equal(result.task.owner, "alice");
    assert.equal(result.task.nextOwner, "bob");
    assert.match(readFileSync(resolve(bob, "src/agent.js"), "utf8"), /foundation/);
    assert.match(readFileSync(resolve(bob, ".ai-team/TASK.md"), "utf8"), /preserve this public contract/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("installed checker runs without package dependencies", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-cli-"));
  try {
    installRepositoryFiles({ target: root });
    const result = spawnSync(process.execPath, [resolve(root, ".ai-team/check.mjs"), "--json"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).valid, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installed checker runs when invoked through a symlinked repository path", () => {
  const sandbox = mkdtempSync(resolve(tmpdir(), "vibecollab-cli-symlink-"));
  const root = resolve(sandbox, "physical");
  const alias = resolve(sandbox, "logical");
  try {
    mkdirSync(root);
    installRepositoryFiles({ target: root });
    symlinkSync(root, alias, process.platform === "win32" ? "junction" : "dir");
    const result = spawnSync(process.execPath, [resolve(alias, ".ai-team/check.mjs"), "--json"], {
      cwd: alias,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).valid, true);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("legacy provider emits canonical-task-view@1 with explicit gaps", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-canonical-"));
  try {
    installRepositoryFiles({ target: root });
    replaceTask(root, [
      ["- ID: `TASK-000`", "- ID: `TASK-001`"],
      ["- Title: `Define the first shared task`", "- Title: `Implement one observable outcome`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["Replace this planning task with one concrete, observable outcome.", "Return the same source-backed task semantics"],
      ["- Replace with the files, components, or behaviors this task may change.", "- src/**"],
      ["- Replace with adjacent work this task must not absorb.", "- Unrelated refactors"],
      ["- [ ] Define at least one Given/When/Then or equivalent verifiable scenario.", "- [x] Given X, when Y, then Z"],
      ["- [ ] Replace with the repository's required check commands and results.", "- [x] [self] python -m unittest"],
      ["Fill this file, assign one owner, and open the first implementation PR.", "Run the parity fixture"],
    ]);

    const view = buildCanonicalTaskView({ root });
    assert.equal(view.schemaVersion, 1);
    assert.equal(view.provider, "repo-task-sync-legacy");
    assert.equal(view.state, "ready");
    assert.deepEqual(view.scope, { allowed: ["src/**"], nonGoals: ["Unrelated refactors"] });
    assert.deepEqual(view.acceptance, [{ text: "Given X, when Y, then Z", status: "satisfied" }]);
    assert.deepEqual(view.verification, [{ text: "python -m unittest", status: "passed", independence: "self" }]);
    assert.equal(view.revision, null);
    assert.ok(view.gaps.some((item) => item.field === "revision"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy handoff preserves published state without inventing prior core state", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-handoff-view-"));
  try {
    installRepositoryFiles({ target: root });
    replaceTask(root, [
      ["- Status: `planning`", "- Status: `handoff`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["- Next owner: `unassigned`", "- Next owner: `bob`"],
    ]);
    const view = buildCanonicalTaskView({ root });
    assert.equal(view.state, null);
    assert.equal(view.handoffState, "published");
    assert.ok(view.gaps.some((item) => item.field === "state"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migration preview is deterministic and writes no target bundle", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-migration-preview-"));
  try {
    installRepositoryFiles({ target: root });
    const preview = buildMigrationPreview({ root });
    assert.equal(preview.writes, false);
    assert.equal(preview.migratable, true);
    assert.equal(preview.targetProvider, "project-to-act");
    assert.equal(preview.bundle["TASK.json"].taskId, "TASK-000");
    assert.equal(existsSync(resolve(root, ".project-to-act")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migration preview blocks a legacy handoff until its core state is chosen", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-migration-handoff-"));
  try {
    installRepositoryFiles({ target: root });
    replaceTask(root, [
      ["- Status: `planning`", "- Status: `handoff`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
      ["- Next owner: `unassigned`", "- Next owner: `bob`"],
    ]);
    const preview = buildMigrationPreview({ root });
    assert.equal(preview.migratable, false);
    assert.ok(preview.blockers.some((item) => item.field === "state"));
    assert.equal(existsSync(resolve(root, ".project-to-act")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy canonical provider rejects a symlinked TASK.md", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-task-symlink-"));
  try {
    installRepositoryFiles({ target: root });
    const taskPath = resolve(root, ".ai-team/TASK.md");
    const sourcePath = resolve(root, ".ai-team/TASK-source.md");
    writeFileSync(sourcePath, readFileSync(taskPath, "utf8"), "utf8");
    rmSync(taskPath);
    symlinkSync(sourcePath, taskPath, "file");
    assert.throws(() => buildCanonicalTaskView({ root }), /must be a regular in-repository file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("one setup command installs, diagnoses, and reports a private Git repository", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-one-command-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Alice");
    const cli = resolve("scripts/cli.mjs");
    const run = (...args) => {
      const result = spawnSync(process.execPath, [cli, ...args, "--target", root, "--json"], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };

    const setup = run("setup", "--private");
    assert.equal(setup.ok, true);
    assert.equal(setup.actor, "Alice");
    assert.equal(setup.privateSessions, true);
    assert.equal(existsSync(resolve(root, ".codex/hooks.json")), true);

    const doctor = run("doctor");
    assert.equal(doctor.ok, true);
    assert.equal(doctor.checks.gitIdentity, true);
    assert.equal(doctor.checks.privateHook, true);

    const report = run("report");
    assert.equal(report.ok, true);
    assert.equal(report.sessions.enabled, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("transcript token parser fails closed when the numeric Codex event is absent", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-transcript-fallback-"));
  try {
    const path = resolve(root, "changed-format.jsonl");
    writeFileSync(
      path,
      `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "do not copy me" } })}\nnot-json\n`,
      "utf8",
    );
    const usage = extractTokenUsageFromTranscript(path);
    assert.equal(usage.availability, "unavailable");
    assert.equal(usage.reason, "supported-token-event-not-found");
    assert.equal(usage.totalTokens, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("private installation records Codex hook events into one low-priority Markdown per session", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-private-session-"));
  try {
    git(root, "init", "-b", "main");
    configureGit(root, "Alice");
    const installed = installRepositoryFiles({ target: root, privateSessions: true });
    assert.equal(installed.privateSessions, true);
    assert.ok(installed.created.includes(".ai-team/session-policy.json"));
    assert.ok(installed.created.includes(".codex/hooks.json"));
    replaceTask(root, [
      ["- ID: `TASK-000`", "- ID: `AGENT-PRIVATE-001`"],
      ["- Title: `Define the first shared task`", "- Title: `Build one private agent`"],
      ["- Status: `planning`", "- Status: `active`"],
      ["- Owner: `unassigned`", "- Owner: `alice`"],
    ]);
    git(root, "add", ".");
    git(root, "commit", "-m", "chore: install private collaboration journal");

    const sessionScript = resolve(root, ".ai-team/session.mjs");
    const send = (payload, actor = "alice") => {
      const result = spawnSync(process.execPath, [sessionScript, "hook"], {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify(payload),
        env: { ...process.env, VIBECOLLAB_ACTOR: actor },
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    };
    const common = { session_id: "thr_private_1", cwd: root, model: "codex-test" };
    const hooks = JSON.parse(readFileSync(resolve(root, ".codex/hooks.json"), "utf8"));
    const hook = hooks.hooks.SessionStart[0].hooks[0];
    const platformCommand = process.platform === "win32" ? hook.commandWindows : hook.command;
    assert.equal(typeof platformCommand, "string");
    const nestedCwd = resolve(root, "nested/workspace");
    mkdirSync(nestedCwd, { recursive: true });
    const platformStart = spawnSync(platformCommand, {
        cwd: nestedCwd,
        encoding: "utf8",
        input: JSON.stringify({
          ...common,
          cwd: nestedCwd,
          hook_event_name: "SessionStart",
          source: "startup",
          timestamp: "2026-08-10T02:00:00.000Z",
        }),
        env: { ...process.env, VIBECOLLAB_ACTOR: "alice" },
        shell: true,
        windowsHide: true,
      });
    assert.equal(platformStart.status, 0, platformStart.stderr || platformStart.stdout);
    send({
      ...common,
      hook_event_name: "UserPromptSubmit",
      turn_id: "turn-1",
      prompt: "实现暂停与恢复；恢复后不得重复执行。",
      timestamp: "2026-08-10T02:01:00.000Z",
    });
    const transcriptPath = resolve(root, "private-codex-transcript.jsonl");
    const transcriptSecret = "TRANSCRIPT_SECRET_MUST_NEVER_BE_COPIED";
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: transcriptSecret } }),
        JSON.stringify({
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: {
                input_tokens: 180,
                cached_input_tokens: 40,
                output_tokens: 30,
                reasoning_output_tokens: 12,
                total_tokens: 222,
              },
            },
          },
        }),
      ].join("\n") + "\n",
      "utf8",
    );
    send({
      ...common,
      hook_event_name: "Stop",
      turn_id: "turn-1",
      last_assistant_message: "已实现暂停、幂等恢复和状态机测试。",
      transcript_path: transcriptPath,
      timestamp: "2026-08-10T02:10:00.000Z",
    });
    send({ ...common, hook_event_name: "SessionEnd", reason: "other", timestamp: "2026-08-10T02:12:00.000Z" });

    const bob = { session_id: "thr_private_2", cwd: root, model: "codex-test" };
    send({ ...bob, hook_event_name: "SessionStart", source: "startup", timestamp: "2026-08-10T03:00:00.000Z" }, "bob");
    send(
      {
        ...bob,
        hook_event_name: "UserPromptSubmit",
        turn_id: "turn-2",
        prompt: "继续实现恢复后的移动端状态展示。",
        timestamp: "2026-08-10T03:01:00.000Z",
      },
      "bob",
    );
    send(
      {
        ...bob,
        hook_event_name: "Stop",
        turn_id: "turn-2",
        last_assistant_message: "已完成移动端状态展示。",
        token_usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
        token_usage_source: "test-event",
        timestamp: "2026-08-10T03:05:00.000Z",
      },
      "bob",
    );
    send({ ...bob, hook_event_name: "SessionEnd", reason: "other", timestamp: "2026-08-10T03:06:00.000Z" }, "bob");

    const markdownPath = resolve(root, ".ai-team/sessions/2026-08/thr_private_1.md");
    assert.equal(existsSync(markdownPath), true);
    const markdown = readFileSync(markdownPath, "utf8");
    assert.match(markdown, /read_priority: "low"/);
    assert.match(markdown, /实现暂停与恢复；恢复后不得重复执行。/);
    assert.match(markdown, /已实现暂停、幂等恢复和状态机测试。/);
    assert.match(markdown, /elapsed_seconds: 720/);
    assert.match(markdown, /token_availability: "reported"/);
    assert.match(markdown, /token_source: "codex-transcript"/);
    assert.match(markdown, /token_parser_version: 1/);
    assert.match(markdown, /total_tokens: 222/);
    assert.doesNotMatch(markdown, new RegExp(transcriptSecret));
    assert.doesNotMatch(markdown, /chain.of.thought/i);
    assert.equal(existsSync(resolve(root, ".ai-team/sessions/2026-08/thr_private_2.md")), true);

    const checked = validateRepository({ root });
    assert.equal(checked.valid, true, checked.errors.join("\n"));
    assert.equal(checked.sessions.enabled, true);
    assert.equal(checked.sessions.totals.sessions, 2);
    assert.deepEqual(checked.sessions.byActor, { alice: 1, bob: 1 });
    assert.deepEqual(checked.sessions.totals.tokenCoverage, { reported: 2, total: 2 });
    assert.equal(checked.sessions.totals.totalTokens, 372);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("private session policy rejects verbatim capture when repository visibility is not private", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vibecollab-public-session-"));
  try {
    installRepositoryFiles({ target: root, privateSessions: true });
    const policyPath = resolve(root, ".ai-team/session-policy.json");
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    policy.repositoryVisibility = "public";
    writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");

    const checked = validateRepository({ root });
    assert.equal(checked.valid, false);
    assert.match(checked.errors.join("\n"), /repositoryVisibility=private/);

    const hook = spawnSync(process.execPath, [resolve(root, ".ai-team/session.mjs"), "hook"], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({
        session_id: "thr_public",
        cwd: root,
        hook_event_name: "UserPromptSubmit",
        turn_id: "turn-1",
        prompt: "must not be written",
      }),
      windowsHide: true,
    });
    assert.equal(hook.status, 1);
    assert.equal(existsSync(resolve(root, ".ai-team/sessions/2026-08/thr_public.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
