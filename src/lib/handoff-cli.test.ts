import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const cli = resolve(process.cwd(), "skills", "project-to-act-collaboration", "scripts", "pta.mjs");
const fixtures: string[] = [];

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function git(root: string, ...args: string[]) {
  return run("git", args, root);
}

function pta(root: string, ...args: string[]) {
  return JSON.parse(run(process.execPath, [cli, ...args, "--project-root", root], root));
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildTwoCloneJourney() {
  const fixture = mkdtempSync(join(tmpdir(), "vibecollab-handoff-"));
  fixtures.push(fixture);
  const remote = join(fixture, "remote.git");
  const alice = join(fixture, "alice");
  const bob = join(fixture, "bob");
  mkdirSync(remote);
  run("git", ["init", "--bare"], remote);
  git(remote, "symbolic-ref", "HEAD", "refs/heads/main");
  mkdirSync(alice);
  git(alice, "init", "-b", "main");
  git(alice, "config", "user.name", "Alice");
  git(alice, "config", "user.email", "alice@example.invalid");
  git(alice, "config", "commit.gpgSign", "false");
  pta(alice, "init");
  writeJson(join(alice, "package.json"), { name: "handoff-fixture", version: "1.0.0" });
  git(alice, "add", ".");
  git(alice, "commit", "-m", "chore: initialize fixture");
  git(alice, "remote", "add", "origin", remote);
  git(alice, "push", "-u", "origin", "main");
  git(alice, "switch", "-c", "task/vc-101");
  pta(alice, "task", "create", "VC-101", "--title", "Build shared agent", "--owner", "alice");
  const taskRoot = join(alice, ".project-to-act", "tasks", "VC-101");
  const task = JSON.parse(readFileSync(join(taskRoot, "TASK.json"), "utf8"));
  writeJson(join(taskRoot, "TASK.json"), {
    ...task,
    goal: "Build one agent through sequential handoff",
    reason: "Verify A to B continuity",
    currentBehavior: "No agent",
    expectedBehavior: "Agent works",
    scope: { allowed: ["src/**"], nonGoals: [] },
    invariants: ["one active writer"],
    authoritativeContext: [],
    acceptance: ["Bob continues from Alice's exact handoff"],
    verification: ["npm test"],
  });
  const intent = JSON.parse(readFileSync(join(taskRoot, "INTENT.json"), "utf8"));
  writeJson(join(taskRoot, "INTENT.json"), { ...intent, paths: ["src/**"], symbols: ["agent"] });
  const context = pta(alice, "context", "build", "VC-101");
  expect(context.contextHash).toHaveLength(64);
  pta(alice, "task", "transition", "VC-101", "--state", "in_progress", "--expected-revision", "1");
  pta(alice, "session", "start", "VC-101", "--actor", "alice", "--executor", "cursor", "--expected-revision", "2");
  mkdirSync(join(alice, "src"));
  writeFileSync(join(alice, "src", "agent.ts"), "export const agent = 'alice';\n", "utf8");
  git(alice, "add", "src/agent.ts");
  git(alice, "commit", "-m", "feat: add agent foundation");
  const published = pta(
    alice,
    "handoff",
    "publish",
    "VC-101",
    "--from",
    "alice",
    "--to",
    "bob",
    "--summary",
    "Agent foundation is complete",
    "--completed",
    "agent contract;basic implementation",
    "--pending",
    "add tools",
    "--decisions",
    "keep one exported agent",
    "--next-action",
    "Implement tool routing",
    "--verification",
    "passed",
    "--checks",
    "npm test",
    "--expected-revision",
    "3",
    "--push",
  );
  expect(published.handoff).toMatchObject({ state: "published", from: "alice", to: "bob", taskRevision: 5 });
  expect(published.sync.pushed).toBe(true);
  run("git", ["clone", remote, bob], fixture);
  git(bob, "config", "user.name", "Bob");
  git(bob, "config", "user.email", "bob@example.invalid");
  git(bob, "config", "commit.gpgSign", "false");
  git(bob, "switch", "--track", "origin/task/vc-101");
  return { alice, bob, published };
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("single-task sequential handoff", () => {
  it("publishes from Alice and lets Bob accept the same task with all anchors verified", () => {
    const { bob, published } = buildTwoCloneJourney();
    const rejected = spawnSync(
      process.execPath,
      [cli, "handoff", "accept", "VC-101", "--actor", "charlie", "--executor", "human", "--project-root", bob],
      {
        cwd: bob,
        encoding: "utf8",
        windowsHide: true,
        timeout: 15_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("不是 charlie");
    const accepted = pta(
      bob,
      "handoff",
      "accept",
      "VC-101",
      "--actor",
      "bob",
      "--executor",
      "claude-code",
      "--pull",
      "--push",
    );
    expect(accepted.handoff).toMatchObject({
      handoffId: published.handoff.handoffId,
      state: "accepted",
      acceptedBy: "bob",
      acceptedRevision: 6,
    });
    expect(accepted.session).toMatchObject({ actorId: "bob", executor: "claude-code", status: "running" });
    expect(accepted.aiPrompt).toContain("Implement tool routing");
    const status = JSON.parse(readFileSync(join(bob, ".project-to-act", "tasks", "VC-101", "STATUS.json"), "utf8"));
    expect(status).toMatchObject({ currentActor: "bob", handoffState: "accepted", revision: 6 });
    expect(pta(bob, "validate")).toMatchObject({ valid: true });
  }, 90_000);
});
