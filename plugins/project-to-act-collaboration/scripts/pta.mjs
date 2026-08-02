#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ACTIVE_STATES = new Set(["ready", "in_progress", "blocked", "review"]);
const ALL_STATES = new Set([...ACTIVE_STATES, "draft", "done", "cancelled"]);
const STATE_TRANSITIONS = new Map([
  ["draft", new Set(["ready", "in_progress", "cancelled"])],
  ["ready", new Set(["in_progress", "blocked", "cancelled"])],
  ["in_progress", new Set(["blocked", "review", "cancelled"])],
  ["blocked", new Set(["ready", "in_progress", "cancelled"])],
  ["review", new Set(["in_progress", "blocked", "done"])],
  ["done", new Set()],
  ["cancelled", new Set()],
]);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_CONFIG = {
  schemaVersion: 1,
  taskStore: ".project-to-act/tasks",
  contractStore: ".project-to-act/contracts",
  projectionStore: ".project-to-act/projections",
  telemetryStore: ".project-to-act/telemetry",
  runtimeStore: ".project-to-act/runtime",
  github: { mode: "mirror" },
  context: { algorithm: "sha256", requireFreshForActiveTasks: true },
  telemetry: {
    schemaVersion: 1,
    heartbeatStaleSeconds: 180,
    prohibitPromptContent: true,
    metricsAreNotPerformanceScores: true,
  },
};

const BASE_DOCUMENTS = {
  "PROJECT_CONFIG.json": `${JSON.stringify({ schema_version: 1, mode: "managed" }, null, 2)}\n`,
  "PROJECT_OVERVIEW.md": `# 项目总览

## 基本信息

- 项目名称：待填写
- 当前阶段：初始化

## 项目目标

- 待填写

## 范围

### 包含

- 待填写

### 非目标

- 待填写

## 技术路线与关键约束

- 待填写

## 当前焦点

- 待填写

## 按需读取索引

- 任务事实：\`.project-to-act/tasks/<ID>/\`

## 路线变更记录

- 暂无
`,
  "PROJECT_PROGRESS.md": `# 项目进度

## 当前任务

任务级状态以 \`.project-to-act/tasks/\` 为准，本文件只保存项目级里程碑。

## 阻塞项

- 暂无

## 下一步

- 创建第一个任务契约。

## 进度历史

- 暂无
`,
  "PROJECT_FEATURES.md": `# 项目功能

## 状态定义

- 候选、已规划、进行中、已阻塞、已完成、已取消。

## 功能清单

- 待填写

## 功能变更历史

- 暂无
`,
  "PROJECT_VERSIONS.md": `# 项目版本

## 当前版本

- 版本号：\`0.0.0\`
- 发布状态：未发布

## 下一版本计划

- 待填写

## 版本历史

- 暂无
`,
  "PROJECT_ACCEPTANCE.md": `# 项目验收

## 当前验收结论

- 结论：未验收

## 验收标准

- 待填写

## 证据索引

- 暂无

## Gate 记录

- 暂无

## 验收记录

- 暂无
`,
};

const AGENTS_BLOCK = `
<!-- project-to-act-collaboration:start -->
## 通用开发协作协议

- 项目级事实保存在 \`.project-to-act/PROJECT_*.md\`，任务级唯一事实保存在 \`.project-to-act/tasks/<ID>/\`；GitHub Issue 只做镜像和讨论入口。
- 所有人和 AI 工具读取 \`.project-to-act/skill/SKILL.md\`；Codex、Cursor、Claude Code、Copilot 等配置只做薄适配，不得维护独立流程。
- 开始任务前读取 \`TASK.json\`，完成 \`INTENT.json\`，构建上下文，再通过带 revision 的状态转换开始工作。
- 实际工作使用 \`session start/heartbeat/stop\` 记录统一的 actor、executor 和隐私受控工作量事件；不保存完整提示、思维链或键盘行为。
- 一个任务一个分支和独立 worktree。公共契约、数据库迁移、认证、支付/积分和状态机必须只有一个写入负责人。
- AI 对话和 Memory 不是事实源。决策、范围变化、验证证据和交接必须写回仓库。
- 提交或交接前运行 \`node .project-to-act/bin/pta.mjs validate --ci\`，不得绕过陈旧上下文、意图冲突或 CI 门禁。
<!-- project-to-act-collaboration:end -->
`;

const GITHUB_WORKFLOW = `name: Project-to-Act protocol

on:
  pull_request:
  push:
    branches: [main]
  merge_group:

permissions:
  contents: read

jobs:
  project-to-act:
    name: project-to-act
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node .project-to-act/bin/pta.mjs validate --project-root . --ci
`;

const GITHUB_TASK_MIRROR = `name: Project-to-Act task mirror
description: Discuss a repository-backed task without creating a second specification
title: "[TASK-ID] "
body:
  - type: input
    id: task-id
    attributes:
      label: Task ID
      placeholder: AL-042
    validations:
      required: true
  - type: input
    id: task-path
    attributes:
      label: Canonical task path
      description: Link to .project-to-act/tasks/<ID>/TASK.json
    validations:
      required: true
  - type: textarea
    id: discussion
    attributes:
      label: Discussion or decision request
      description: Approved specification changes must be written back to the task directory.
    validations:
      required: true
`;

const GITHUB_PR_TEMPLATE = `## Project-to-Act evidence

- Task ID:
- Context hash:
- Status revision:
- Canonical task: \`.project-to-act/tasks/<ID>/TASK.json\`
- Specification deviations: none / linked approval
- Verification evidence:
- Residual risks:

- [ ] Intent scope matches this diff
- [ ] Context is fresh
- [ ] Required checks passed on the latest commit
- [ ] Public contracts and migrations have one owner
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return { positional, flags };
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function projectRoot(flags) {
  return resolve(String(flags["project-root"] || process.cwd()));
}

function assertInside(root, path) {
  const target = resolve(path);
  const rel = relative(root, target);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return target;
  fail(`路径越出项目根目录：${target}`);
}

function assertSafeAncestors(root, target) {
  let cursor = dirname(target);
  while (cursor.startsWith(root) && cursor !== root) {
    if (existsSync(cursor)) {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) fail(`拒绝通过符号链接写入：${cursor}`);
    }
    cursor = dirname(cursor);
  }
}

function ensureDir(root, path) {
  const target = assertInside(root, path);
  assertSafeAncestors(root, target);
  mkdirSync(target, { recursive: true });
  return target;
}

function writeIfMissing(root, path, content, actions) {
  const target = assertInside(root, path);
  if (existsSync(target)) {
    actions.skipped.push(relative(root, target).replaceAll("\\", "/"));
    return false;
  }
  ensureDir(root, dirname(target));
  writeFileSync(target, content, { encoding: "utf8", flag: "wx" });
  actions.created.push(relative(root, target).replaceAll("\\", "/"));
  return true;
}

function atomicWrite(root, path, content) {
  const target = assertInside(root, path);
  ensureDir(root, dirname(target));
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp, content, "utf8");
  renameSync(temp, target);
}

function writeJson(root, path, value) {
  atomicWrite(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path, label = path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} 不是有效 JSON：${error.message}`);
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function contextFileFact(path) {
  const raw = readFileSync(path);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    if (!text.includes("\0")) {
      const normalized = Buffer.from(text.replace(/\r\n?/gu, "\n"), "utf8");
      return {
        sha256: sha256(normalized),
        bytes: normalized.byteLength,
        normalization: "utf8-lf",
      };
    }
  } catch {
    // Binary or non-UTF-8 context remains byte-exact.
  }
  return { sha256: sha256(raw), bytes: raw.byteLength, normalization: "binary" };
}

function normalizeRelative(value) {
  return String(value).trim().replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/+$/u, "");
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
}

function gitValue(root, args, fallback = "UNAVAILABLE") {
  const result = git(root, args);
  return result.status === 0 ? result.stdout.trim() || fallback : fallback;
}

function now() {
  return new Date().toISOString();
}

function taskId(value) {
  const id = String(value || "").toUpperCase();
  if (!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/u.test(id)) fail(`无效任务 ID：${value || "<empty>"}`, 2);
  return id;
}

function taskDir(root, id) {
  return assertInside(root, resolve(root, ".project-to-act", "tasks", taskId(id)));
}

function taskPaths(root, id) {
  const dir = taskDir(root, id);
  return {
    dir,
    task: resolve(dir, "TASK.json"),
    intent: resolve(dir, "INTENT.json"),
    context: resolve(dir, "CONTEXT.json"),
    status: resolve(dir, "STATUS.json"),
    handoff: resolve(dir, "HANDOFF.md"),
    events: resolve(dir, "events"),
    evidence: resolve(dir, "evidence"),
  };
}

function listTaskIds(root) {
  const rootPath = resolve(root, ".project-to-act", "tasks");
  if (!existsSync(rootPath)) return [];
  return readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function loadTaskBundle(root, id) {
  const paths = taskPaths(root, id);
  for (const required of [paths.task, paths.intent, paths.status]) {
    if (!existsSync(required)) fail(`任务 ${id} 缺少 ${relative(root, required)}`);
  }
  return {
    paths,
    task: readJson(paths.task, `${id}/TASK.json`),
    intent: readJson(paths.intent, `${id}/INTENT.json`),
    status: readJson(paths.status, `${id}/STATUS.json`),
  };
}

function validateTaskBundle(bundle, { active = false } = {}) {
  const errors = [];
  const { task, intent, status } = bundle;
  if (task.schemaVersion !== 1) errors.push("TASK.schemaVersion 必须为 1");
  if (task.taskId !== status.taskId || task.taskId !== intent.taskId)
    errors.push("TASK/INTENT/STATUS 的 taskId 不一致");
  if (!ALL_STATES.has(status.state)) errors.push(`未知状态：${status.state}`);
  if (!Number.isInteger(status.revision) || status.revision < 0) errors.push("STATUS.revision 必须为非负整数");
  if (!Array.isArray(intent.paths) || !Array.isArray(intent.symbols) || !Array.isArray(intent.contractsWrite)) {
    errors.push("INTENT 的 paths、symbols、contractsWrite 必须是数组");
  }
  if (active) {
    for (const [key, value] of [
      ["title", task.title],
      ["owner", task.owner],
      ["goal", task.goal],
      ["reason", task.reason],
    ]) {
      if (!String(value || "").trim()) errors.push(`活动任务缺少 TASK.${key}`);
    }
    if (!Array.isArray(task.acceptance) || task.acceptance.length === 0)
      errors.push("活动任务至少需要一个 acceptance 场景");
    if (!Array.isArray(task.verification) || task.verification.length === 0)
      errors.push("活动任务至少需要一个 verification 命令");
    if (
      (intent.paths || []).length === 0 &&
      (intent.symbols || []).length === 0 &&
      (intent.contractsWrite || []).length === 0
    ) {
      errors.push("活动任务必须声明至少一个修改意图");
    }
  }
  return errors;
}

function pathPrefix(pattern) {
  const normalized = normalizeRelative(pattern);
  const wildcard = normalized.search(/[?*\[]/u);
  return (wildcard >= 0 ? normalized.slice(0, wildcard) : normalized).replace(/\/+$/u, "");
}

function pathsOverlap(left, right) {
  const a = pathPrefix(left);
  const b = pathPrefix(right);
  if (!a || !b) return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function conflictBetween(left, right) {
  const reasons = [];
  for (const a of left.intent.paths || []) {
    for (const b of right.intent.paths || []) {
      if (pathsOverlap(a, b)) reasons.push({ type: "path", left: a, right: b });
    }
  }
  for (const field of ["symbols", "contractsWrite"]) {
    const other = new Set(right.intent[field] || []);
    for (const value of left.intent[field] || []) {
      if (other.has(value)) reasons.push({ type: field, value });
    }
  }
  if (left.intent.migrations && right.intent.migrations) reasons.push({ type: "migration-sequence" });
  return reasons;
}

function findConflicts(root, candidateId = null, includeDraftCandidate = false) {
  const bundles = listTaskIds(root).map((id) => loadTaskBundle(root, id));
  const selected = bundles.filter(
    (bundle) => ACTIVE_STATES.has(bundle.status.state) || (includeDraftCandidate && bundle.task.taskId === candidateId),
  );
  const conflicts = [];
  for (let left = 0; left < selected.length; left += 1) {
    for (let right = left + 1; right < selected.length; right += 1) {
      const reasons = conflictBetween(selected[left], selected[right]);
      if (reasons.length > 0)
        conflicts.push({ tasks: [selected[left].task.taskId, selected[right].task.taskId], reasons });
    }
  }
  return conflicts;
}

function buildContext(root, id) {
  return withTaskLock(root, id, () => {
    const bundle = loadTaskBundle(root, id);
    const defaultInputs = [
      "AGENTS.md",
      ".project-to-act/PROJECT_OVERVIEW.md",
      ".project-to-act/COLLABORATION_CONFIG.json",
      ".project-to-act/skill/SKILL.md",
      `.project-to-act/tasks/${id}/TASK.json`,
      `.project-to-act/tasks/${id}/INTENT.json`,
    ];
    const requested = [
      ...new Set([...defaultInputs, ...(bundle.task.authoritativeContext || [])].map(normalizeRelative)),
    ];
    const inputs = requested.map((path) => {
      const absolute = assertInside(root, resolve(root, path));
      if (!existsSync(absolute)) fail(`上下文文件不存在：${path}`);
      return { path, ...contextFileFact(absolute) };
    });
    const stableContext = {
      schemaVersion: 1,
      taskId: id,
      baseSha: bundle.task.baseSha || gitValue(root, ["rev-parse", "HEAD"]),
      inputs,
    };
    const manifest = {
      ...stableContext,
      createdAt: now(),
      contextHash: sha256(JSON.stringify(stableContext)),
    };
    writeJson(root, bundle.paths.context, manifest);
    const nextStatus = {
      ...bundle.status,
      contextHash: manifest.contextHash,
      updatedAt: now(),
      revision: bundle.status.revision + 1,
    };
    writeJson(root, bundle.paths.status, nextStatus);
    return manifest;
  });
}

function withTaskLock(root, id, operation) {
  const lockPath = assertInside(root, resolve(root, ".project-to-act", "runtime", "locks", `${id}.lock`));
  ensureDir(root, dirname(lockPath));
  let handle;
  try {
    handle = openSync(lockPath, "wx");
  } catch {
    fail(`任务 ${id} 正被另一个本地进程更新，请稍后重试`, 4);
  }
  try {
    return operation();
  } finally {
    closeSync(handle);
    unlinkSync(lockPath);
  }
}

function checkContext(root, id) {
  const { paths } = loadTaskBundle(root, id);
  if (!existsSync(paths.context)) return { fresh: false, taskId: id, reason: "missing-context", changed: [] };
  const context = readJson(paths.context, `${id}/CONTEXT.json`);
  const changed = [];
  for (const input of context.inputs || []) {
    const absolute = assertInside(root, resolve(root, input.path));
    if (!existsSync(absolute)) changed.push({ path: input.path, reason: "missing" });
    else {
      const current = contextFileFact(absolute);
      if (current.sha256 !== input.sha256)
        changed.push({
          path: input.path,
          reason: "hash-changed",
          expected: input.sha256,
          actual: current.sha256,
        });
    }
  }
  return { fresh: changed.length === 0, taskId: id, contextHash: context.contextHash, changed };
}

function appendEvent(root, bundle, type, data) {
  ensureDir(root, bundle.paths.events);
  const timestamp = now();
  const filename = `${timestamp.replace(/[:.]/gu, "-")}-${randomUUID()}.json`;
  const event = { schemaVersion: 1, eventId: randomUUID(), taskId: bundle.task.taskId, type, timestamp, ...data };
  writeFileSync(resolve(bundle.paths.events, filename), `${JSON.stringify(event, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return event;
}

function gitMetrics(root, task) {
  const baseSha = task.baseSha;
  if (!baseSha || baseSha === "UNAVAILABLE") return { available: false };
  if (task.gitBaseline?.clean === false)
    return { available: false, reason: "dirty-baseline", baselineStatusHash: task.gitBaseline.statusHash };
  const diff = git(root, ["diff", "--numstat", `${baseSha}...HEAD`]);
  const commits = git(root, ["rev-list", "--count", `${baseSha}..HEAD`]);
  if (diff.status !== 0 || commits.status !== 0) return { available: false };
  let files = 0;
  let additions = 0;
  let deletions = 0;
  for (const line of diff.stdout.trim().split(/\r?\n/u).filter(Boolean)) {
    const [added, deleted] = line.split("\t");
    files += 1;
    if (/^\d+$/u.test(added)) additions += Number(added);
    if (/^\d+$/u.test(deleted)) deletions += Number(deleted);
  }
  return {
    available: true,
    commits: Number(commits.stdout.trim()),
    files,
    additions,
    deletions,
    headSha: gitValue(root, ["rev-parse", "HEAD"]),
  };
}

function requireRevision(bundle, expected) {
  if (expected === undefined) fail("必须提供 --expected-revision", 2);
  const parsed = Number(expected);
  if (!Number.isInteger(parsed)) fail("--expected-revision 必须是整数", 2);
  if (bundle.status.revision !== parsed) fail(`状态已变化：期望 revision ${parsed}，实际 ${bundle.status.revision}`, 4);
}

function locateSkillFile() {
  const scriptDir = dirname(SCRIPT_PATH);
  const candidates = [
    resolve(scriptDir, "..", "SKILL.md"),
    resolve(scriptDir, "..", "skills", "project-to-act-collaboration", "SKILL.md"),
    resolve(scriptDir, "..", "skill", "SKILL.md"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function copyManagedFile(root, source, target, label, actions, upgrade) {
  if (!source || !existsSync(source)) {
    actions.skipped.push(`${label} (source unavailable)`);
    return;
  }
  if (resolve(source) === resolve(target)) {
    actions.skipped.push(`${label} (already vendored)`);
    return;
  }
  const existed = existsSync(target);
  if (existed && readFileSync(target).equals(readFileSync(source))) {
    actions.skipped.push(label);
    return;
  }
  if (existed && !upgrade) {
    actions.skipped.push(label);
    return;
  }
  ensureDir(root, dirname(target));
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  copyFileSync(source, temp);
  renameSync(temp, target);
  (existed ? actions.updated : actions.created).push(label);
}

function mergedConfig(existing) {
  return {
    ...DEFAULT_CONFIG,
    ...existing,
    github: { ...DEFAULT_CONFIG.github, ...(existing.github || {}) },
    context: { ...DEFAULT_CONFIG.context, ...(existing.context || {}) },
    telemetry: { ...DEFAULT_CONFIG.telemetry, ...(existing.telemetry || {}) },
  };
}

function initRepository(root, flags) {
  const actions = { created: [], updated: [], skipped: [] };
  ensureDir(root, resolve(root, ".project-to-act"));
  for (const [name, content] of Object.entries(BASE_DOCUMENTS)) {
    writeIfMissing(root, resolve(root, ".project-to-act", name), content, actions);
  }
  const collaborationConfig = resolve(root, ".project-to-act", "COLLABORATION_CONFIG.json");
  if (!existsSync(collaborationConfig))
    writeIfMissing(root, collaborationConfig, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, actions);
  else if (flags.upgrade) {
    const existing = readJson(collaborationConfig, "COLLABORATION_CONFIG.json");
    const merged = mergedConfig(existing);
    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      writeJson(root, collaborationConfig, merged);
      actions.updated.push(".project-to-act/COLLABORATION_CONFIG.json");
    } else actions.skipped.push(".project-to-act/COLLABORATION_CONFIG.json");
  } else actions.skipped.push(".project-to-act/COLLABORATION_CONFIG.json");
  for (const name of ["tasks", "contracts", "projections", "telemetry/sessions"]) {
    writeIfMissing(root, resolve(root, ".project-to-act", name, ".gitkeep"), "", actions);
  }
  const runtimeTarget = resolve(root, ".project-to-act", "bin", "pta.mjs");
  if (!existsSync(runtimeTarget) || flags.upgrade) {
    ensureDir(root, dirname(runtimeTarget));
    if (resolve(SCRIPT_PATH) !== resolve(runtimeTarget)) {
      const temp = `${runtimeTarget}.${process.pid}.tmp`;
      copyFileSync(SCRIPT_PATH, temp);
      renameSync(temp, runtimeTarget);
      (existsSync(runtimeTarget) && flags.upgrade ? actions.updated : actions.created).push(
        ".project-to-act/bin/pta.mjs",
      );
    }
  } else actions.skipped.push(".project-to-act/bin/pta.mjs");

  const skillSource = locateSkillFile();
  const vendoredSkill = resolve(root, ".project-to-act", "skill", "SKILL.md");
  copyManagedFile(root, skillSource, vendoredSkill, ".project-to-act/skill/SKILL.md", actions, Boolean(flags.upgrade));
  for (const reference of ["protocol.md", "monitoring.md", "adapters.md"]) {
    const source = skillSource ? resolve(dirname(skillSource), "references", reference) : null;
    copyManagedFile(
      root,
      source,
      resolve(root, ".project-to-act", "skill", "references", reference),
      `.project-to-act/skill/references/${reference}`,
      actions,
      Boolean(flags.upgrade),
    );
  }

  const agentsPath = resolve(root, "AGENTS.md");
  if (!existsSync(agentsPath))
    writeIfMissing(root, agentsPath, `# Repository agent instructions\n${AGENTS_BLOCK}`, actions);
  else {
    const current = readFileSync(agentsPath, "utf8");
    if (!current.includes("<!-- project-to-act-collaboration:start -->")) {
      atomicWrite(root, agentsPath, `${current.trimEnd()}\n${AGENTS_BLOCK}`);
      actions.updated.push("AGENTS.md");
    } else if (flags.upgrade) {
      const updated = current.replace(
        /<!-- project-to-act-collaboration:start -->[\s\S]*?<!-- project-to-act-collaboration:end -->/u,
        AGENTS_BLOCK.trim(),
      );
      if (updated !== current) {
        atomicWrite(root, agentsPath, updated);
        actions.updated.push("AGENTS.md managed block");
      } else actions.skipped.push("AGENTS.md managed block");
    } else actions.skipped.push("AGENTS.md managed block");
  }

  const gitignore = resolve(root, ".gitignore");
  if (!existsSync(gitignore)) writeIfMissing(root, gitignore, ".project-to-act/runtime/\n", actions);
  else {
    const current = readFileSync(gitignore, "utf8");
    if (!current.split(/\r?\n/u).includes(".project-to-act/runtime/")) {
      atomicWrite(root, gitignore, `${current.trimEnd()}\n.project-to-act/runtime/\n`);
      actions.updated.push(".gitignore");
    } else actions.skipped.push(".gitignore runtime rule");
  }

  if (flags.github) {
    writeIfMissing(root, resolve(root, ".github", "workflows", "project-to-act.yml"), GITHUB_WORKFLOW, actions);
    const existingTaskTemplate = resolve(root, ".github", "ISSUE_TEMPLATE", "ai-task.yml");
    if (existsSync(existingTaskTemplate))
      actions.skipped.push(".github/ISSUE_TEMPLATE/project-to-act-task.yml (existing ai-task.yml)");
    else
      writeIfMissing(
        root,
        resolve(root, ".github", "ISSUE_TEMPLATE", "project-to-act-task.yml"),
        GITHUB_TASK_MIRROR,
        actions,
      );
    writeIfMissing(
      root,
      resolve(root, ".github", "PULL_REQUEST_TEMPLATE", "project-to-act.md"),
      GITHUB_PR_TEMPLATE,
      actions,
    );
  }
  return actions;
}

function createTask(root, id, flags) {
  const paths = taskPaths(root, id);
  ensureDir(root, resolve(root, ".project-to-act", "tasks"));
  try {
    mkdirSync(paths.dir);
  } catch {
    fail(`任务已存在或正被并发创建：${id}`, 4);
  }
  ensureDir(root, paths.events);
  ensureDir(root, paths.evidence);
  const timestamp = now();
  const baseSha = gitValue(root, ["rev-parse", "HEAD"]);
  const gitStatus = git(root, ["status", "--porcelain"]);
  const statusText = gitStatus.status === 0 ? gitStatus.stdout : null;
  const branch = String(flags.branch || gitValue(root, ["branch", "--show-current"], `task/${id.toLowerCase()}`));
  const task = {
    schemaVersion: 1,
    taskId: id,
    title: String(flags.title || ""),
    owner: String(flags.owner || ""),
    goal: "",
    reason: "",
    currentBehavior: "",
    expectedBehavior: "",
    scope: { allowed: [], nonGoals: [] },
    invariants: [],
    authoritativeContext: [],
    dependencies: [],
    contracts: { read: [], write: [] },
    acceptance: [],
    verification: [],
    baseSha,
    gitBaseline: {
      clean: statusText === null ? null : statusText.trim().length === 0,
      statusHash: statusText === null ? null : sha256(statusText),
    },
    createdAt: timestamp,
  };
  const intent = {
    schemaVersion: 1,
    taskId: id,
    revision: 0,
    baseSha,
    paths: [],
    symbols: [],
    contractsWrite: [],
    migrations: false,
  };
  const status = {
    schemaVersion: 1,
    taskId: id,
    state: "draft",
    revision: 0,
    owner: task.owner,
    branch,
    contextHash: null,
    updatedAt: timestamp,
    lastCheckpoint: null,
  };
  writeJson(root, paths.task, task);
  writeJson(root, paths.intent, intent);
  writeJson(root, paths.status, status);
  writeFileSync(
    paths.handoff,
    `# ${id} Handoff\n\n- Current result: not started\n- Next action: complete TASK.json and INTENT.json\n- Risks: not assessed\n`,
    "utf8",
  );
  writeFileSync(resolve(paths.events, ".gitkeep"), "", "utf8");
  writeFileSync(resolve(paths.evidence, ".gitkeep"), "", "utf8");
  return { taskId: id, path: relative(root, paths.dir).replaceAll("\\", "/"), status };
}

function transitionTask(root, id, state, expectedRevision) {
  if (!ALL_STATES.has(state)) fail(`无效状态：${state}`, 2);
  return withTaskLock(root, id, () => {
    const bundle = loadTaskBundle(root, id);
    requireRevision(bundle, expectedRevision);
    if (!STATE_TRANSITIONS.get(bundle.status.state)?.has(state))
      fail(`不允许的状态转换：${bundle.status.state} -> ${state}`, 2);
    const active = ACTIVE_STATES.has(state);
    const requiresCompleteContract = active || state === "done";
    const errors = validateTaskBundle(bundle, { active: requiresCompleteContract });
    if (errors.length > 0) fail(`任务不能进入 ${state}：\n- ${errors.join("\n- ")}`);
    if (requiresCompleteContract) {
      const freshness = checkContext(root, id);
      if (!freshness.fresh) fail(`任务上下文已过期：${JSON.stringify(freshness.changed)}`, 3);
    }
    if (active) {
      const conflicts = findConflicts(root, id, true).filter((conflict) => conflict.tasks.includes(id));
      if (conflicts.length > 0) fail(`任务存在修改意图冲突：${JSON.stringify(conflicts)}`, 3);
    }
    if (state === "done") {
      const evidence = readdirSync(bundle.paths.evidence).filter((name) => name.endsWith(".json"));
      if (evidence.length === 0) fail("完成任务前至少需要一个 evidence/*.json");
    }
    const next = { ...bundle.status, state, revision: bundle.status.revision + 1, updatedAt: now() };
    writeJson(root, bundle.paths.status, next);
    appendEvent(root, bundle, "state-transition", {
      from: bundle.status.state,
      to: state,
      revision: next.revision,
    });
    return next;
  });
}

function checkpoint(root, id, flags) {
  return withTaskLock(root, id, () => {
    const bundle = loadTaskBundle(root, id);
    requireRevision(bundle, flags["expected-revision"]);
    const summary = String(flags.summary || "").trim();
    if (!summary) fail("checkpoint 必须提供 --summary", 2);
    if (ACTIVE_STATES.has(bundle.status.state)) {
      const freshness = checkContext(root, id);
      if (!freshness.fresh) fail(`上下文已过期，拒绝 checkpoint：${JSON.stringify(freshness.changed)}`, 3);
    }
    const metrics = gitMetrics(root, bundle.task);
    const event = appendEvent(root, bundle, "checkpoint", {
      summary,
      metrics,
      revision: bundle.status.revision + 1,
    });
    const next = {
      ...bundle.status,
      revision: bundle.status.revision + 1,
      updatedAt: event.timestamp,
      lastCheckpoint: event.eventId,
      headSha: metrics.headSha || bundle.status.headSha || null,
    };
    writeJson(root, bundle.paths.status, next);
    return { status: next, metrics };
  });
}

function identity(value, label) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(normalized))
    fail(`${label} 必须是 1–64 位字母、数字、点、下划线或连字符`, 2);
  return normalized;
}

function sessionId(value = null) {
  const generated = value || `s-${randomUUID()}`;
  return identity(generated, "session-id");
}

function telemetrySessionPath(root, id) {
  return assertInside(root, resolve(root, ".project-to-act", "telemetry", "sessions", `${sessionId(id)}.json`));
}

function runtimeSessionPath(root, id) {
  return assertInside(root, resolve(root, ".project-to-act", "runtime", "sessions", `${sessionId(id)}.json`));
}

function gitSnapshot(root) {
  const head = git(root, ["rev-parse", "HEAD"]);
  const status = git(root, ["status", "--porcelain"]);
  if (head.status !== 0 || status.status !== 0) return { available: false, reason: "git-unavailable" };
  return {
    available: true,
    headSha: head.stdout.trim(),
    clean: status.stdout.trim().length === 0,
    statusHash: sha256(status.stdout),
  };
}

function gitDeltaFromSession(root, start) {
  if (!start?.available) return { available: false, reason: start?.reason || "git-start-unavailable" };
  if (!start.clean) return { available: false, reason: "dirty-session-start", startStatusHash: start.statusHash };
  const diff = git(root, ["diff", "--numstat", start.headSha]);
  const commits = git(root, ["rev-list", "--count", `${start.headSha}..HEAD`]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]);
  if (diff.status !== 0 || commits.status !== 0 || untracked.status !== 0)
    return { available: false, reason: "git-delta-unavailable" };
  let files = 0;
  let additions = 0;
  let deletions = 0;
  for (const line of diff.stdout.trim().split(/\r?\n/u).filter(Boolean)) {
    const [added, deleted] = line.split("\t");
    files += 1;
    if (/^\d+$/u.test(added)) additions += Number(added);
    if (/^\d+$/u.test(deleted)) deletions += Number(deleted);
  }
  const untrackedFiles = untracked.stdout.trim().split(/\r?\n/u).filter(Boolean).length;
  return {
    available: true,
    source: "verified",
    commits: Number(commits.stdout.trim()),
    files: files + untrackedFiles,
    trackedFiles: files,
    untrackedFiles,
    additions,
    deletions,
    startHeadSha: start.headSha,
    endHeadSha: gitValue(root, ["rev-parse", "HEAD"]),
  };
}

function optionalNumber(flags, key) {
  if (flags[key] === undefined) return null;
  const value = Number(flags[key]);
  if (!Number.isFinite(value) || value < 0) fail(`--${key} 必须是非负数字`, 2);
  return value;
}

function startSession(root, id, flags) {
  return withTaskLock(root, id, () => {
    const bundle = loadTaskBundle(root, id);
    requireRevision(bundle, flags["expected-revision"]);
    if (bundle.status.state !== "in_progress") fail("只有 in_progress 任务可以启动工作会话", 2);
    if (bundle.status.activeSessionId) fail(`任务已有活动会话：${bundle.status.activeSessionId}`, 4);
    const freshness = checkContext(root, id);
    if (!freshness.fresh) fail(`任务上下文已过期：${JSON.stringify(freshness.changed)}`, 3);
    const conflicts = findConflicts(root, id, true).filter((conflict) => conflict.tasks.includes(id));
    if (conflicts.length > 0) {
      appendEvent(root, bundle, "conflict-detected", { conflicts });
      fail(`任务存在修改意图冲突：${JSON.stringify(conflicts)}`, 3);
    }

    const idValue = sessionId(flags["session-id"] || null);
    const actorId = identity(flags.actor, "actor");
    const executor = identity(flags.executor, "executor");
    const telemetryPath = telemetrySessionPath(root, idValue);
    if (existsSync(telemetryPath)) fail(`会话已存在：${idValue}`, 4);
    const startedAt = now();
    const session = {
      schemaVersion: 1,
      sessionId: idValue,
      taskId: id,
      actorId,
      executor,
      executorVersion: flags["executor-version"] ? String(flags["executor-version"]).slice(0, 128) : null,
      model: flags.model ? String(flags.model).slice(0, 128) : null,
      source: "cli-tracked",
      status: "running",
      startedAt,
      endedAt: null,
      elapsedSeconds: null,
      gitStart: gitSnapshot(root),
      gitMetrics: null,
      toolReported: null,
      summary: null,
    };
    ensureDir(root, dirname(telemetryPath));
    writeFileSync(telemetryPath, `${JSON.stringify(session, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    writeJson(root, runtimeSessionPath(root, idValue), {
      schemaVersion: 1,
      sessionId: idValue,
      taskId: id,
      actorId,
      executor,
      startedAt,
      heartbeatAt: startedAt,
    });
    const next = {
      ...bundle.status,
      revision: bundle.status.revision + 1,
      activeSessionId: idValue,
      updatedAt: startedAt,
    };
    writeJson(root, bundle.paths.status, next);
    appendEvent(root, bundle, "session-start", {
      sessionId: idValue,
      actorId,
      executor,
      revision: next.revision,
    });
    return { session, status: next };
  });
}

function heartbeatSession(root, rawSessionId) {
  const id = sessionId(rawSessionId);
  const runtimePath = runtimeSessionPath(root, id);
  if (!existsSync(runtimePath)) fail(`没有活动会话：${id}`);
  const runtime = readJson(runtimePath, `${id} runtime session`);
  const next = { ...runtime, heartbeatAt: now() };
  writeJson(root, runtimePath, next);
  return next;
}

function stopSession(root, rawSessionId, flags) {
  const id = sessionId(rawSessionId);
  const telemetryPath = telemetrySessionPath(root, id);
  if (!existsSync(telemetryPath)) fail(`会话不存在：${id}`);
  const existingSession = readJson(telemetryPath, `${id} telemetry session`);
  return withTaskLock(root, existingSession.taskId, () => {
    const bundle = loadTaskBundle(root, existingSession.taskId);
    requireRevision(bundle, flags["expected-revision"]);
    if (existingSession.status !== "running") fail(`会话已经结束：${id}`, 4);
    if (bundle.status.activeSessionId !== id) fail(`任务活动会话与 ${id} 不一致`, 4);
    const summary = String(flags.summary || "").trim();
    if (!summary) fail("session stop 必须提供 --summary", 2);
    const result = String(flags.result || "completed");
    if (!new Set(["completed", "blocked", "abandoned"]).has(result))
      fail("--result 必须是 completed、blocked 或 abandoned", 2);
    const endedAt = now();
    const elapsedSeconds = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(existingSession.startedAt).getTime()) / 1000),
    );
    const reportedValues = {
      tokensIn: optionalNumber(flags, "tokens-in"),
      tokensOut: optionalNumber(flags, "tokens-out"),
      costUsd: optionalNumber(flags, "cost-usd"),
      testsPassed: optionalNumber(flags, "tests-passed"),
      testsFailed: optionalNumber(flags, "tests-failed"),
    };
    const hasReportedValues = Object.values(reportedValues).some((value) => value !== null);
    const completed = {
      ...existingSession,
      status: result,
      endedAt,
      elapsedSeconds,
      gitMetrics: gitDeltaFromSession(root, existingSession.gitStart),
      toolReported: hasReportedValues ? { source: "tool-reported", ...reportedValues } : null,
      summary,
    };
    writeJson(root, telemetryPath, completed);
    const runtimePath = runtimeSessionPath(root, id);
    if (existsSync(runtimePath)) unlinkSync(runtimePath);
    const next = {
      ...bundle.status,
      revision: bundle.status.revision + 1,
      activeSessionId: null,
      updatedAt: endedAt,
    };
    writeJson(root, bundle.paths.status, next);
    appendEvent(root, bundle, "session-stop", {
      sessionId: id,
      actorId: completed.actorId,
      executor: completed.executor,
      result,
      elapsedSeconds,
      gitMetricsAvailable: completed.gitMetrics.available,
      revision: next.revision,
    });
    return { session: completed, status: next };
  });
}

function listSessions(root) {
  const sessionsRoot = resolve(root, ".project-to-act", "telemetry", "sessions");
  if (!existsSync(sessionsRoot)) return [];
  return readdirSync(sessionsRoot)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(resolve(sessionsRoot, name), name))
    .sort((left, right) => String(left.startedAt).localeCompare(String(right.startedAt)));
}

function sessionStatus(root, config) {
  const staleSeconds = Number(config.telemetry?.heartbeatStaleSeconds || 180);
  const timestamp = Date.now();
  return listSessions(root).map((session) => {
    const runtimePath = runtimeSessionPath(root, session.sessionId);
    const runtime = existsSync(runtimePath) ? readJson(runtimePath, `${session.sessionId} runtime`) : null;
    const heartbeatAgeSeconds = runtime
      ? Math.max(0, Math.round((timestamp - new Date(runtime.heartbeatAt).getTime()) / 1000))
      : null;
    return {
      ...session,
      presence: session.status === "running" ? (runtime ? "online" : "unknown") : "ended",
      heartbeatAt: runtime?.heartbeatAt || null,
      heartbeatAgeSeconds,
      heartbeatStale: heartbeatAgeSeconds !== null && heartbeatAgeSeconds > staleSeconds,
    };
  });
}

function emptyWorkloadBucket() {
  const reportedSessions = {
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    testsPassed: 0,
    testsFailed: 0,
  };
  return {
    sessions: 0,
    completed: 0,
    active: 0,
    elapsedSeconds: 0,
    tasks: [],
    verifiedGit: { sessions: 0, commits: 0, files: 0, additions: 0, deletions: 0 },
    toolReported: {
      sessions: 0,
      reportedSessions,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      testsPassed: 0,
      testsFailed: 0,
    },
  };
}

function addSessionToBucket(bucket, session) {
  bucket.sessions += 1;
  if (session.status === "running") bucket.active += 1;
  else bucket.completed += 1;
  bucket.elapsedSeconds += Number(session.elapsedSeconds || 0);
  if (!bucket.tasks.includes(session.taskId)) bucket.tasks.push(session.taskId);
  if (session.gitMetrics?.available) {
    bucket.verifiedGit.sessions += 1;
    for (const key of ["commits", "files", "additions", "deletions"])
      bucket.verifiedGit[key] += Number(session.gitMetrics[key] || 0);
  }
  if (session.toolReported) {
    bucket.toolReported.sessions += 1;
    for (const key of ["tokensIn", "tokensOut", "costUsd", "testsPassed", "testsFailed"]) {
      if (!Number.isFinite(session.toolReported[key])) continue;
      bucket.toolReported.reportedSessions[key] += 1;
      bucket.toolReported[key] += session.toolReported[key];
    }
  }
}

function finalizeWorkloadBucket(bucket) {
  bucket.tasks.sort();
  for (const key of ["tokensIn", "tokensOut", "costUsd", "testsPassed", "testsFailed"]) {
    if (bucket.toolReported.reportedSessions[key] === 0) bucket.toolReported[key] = null;
  }
  return bucket;
}

function monitorReport(root, write = false) {
  const configPath = resolve(root, ".project-to-act", "COLLABORATION_CONFIG.json");
  const config = existsSync(configPath) ? mergedConfig(readJson(configPath)) : DEFAULT_CONFIG;
  const sessions = sessionStatus(root, config);
  const byActor = {};
  const byExecutor = {};
  const totals = emptyWorkloadBucket();
  for (const session of sessions) {
    byActor[session.actorId] ||= emptyWorkloadBucket();
    byExecutor[session.executor] ||= emptyWorkloadBucket();
    addSessionToBucket(byActor[session.actorId], session);
    addSessionToBucket(byExecutor[session.executor], session);
    addSessionToBucket(totals, session);
  }
  finalizeWorkloadBucket(totals);
  for (const bucket of Object.values(byActor)) finalizeWorkloadBucket(bucket);
  for (const bucket of Object.values(byExecutor)) finalizeWorkloadBucket(bucket);
  const taskEvents = {};
  for (const id of listTaskIds(root)) {
    const eventsPath = taskPaths(root, id).events;
    if (!existsSync(eventsPath)) continue;
    for (const name of readdirSync(eventsPath).filter((entry) => entry.endsWith(".json"))) {
      const event = readJson(resolve(eventsPath, name), name);
      taskEvents[event.type] = (taskEvents[event.type] || 0) + 1;
    }
  }
  const report = {
    schemaVersion: 1,
    generatedAt: now(),
    semantics: {
      elapsedSeconds: "tracked session elapsed time; not focused work time",
      verifiedGit: "change volume; not value or performance",
      toolReported: "optional executor-provided data; may be incomplete",
    },
    totals,
    byActor,
    byExecutor,
    taskEvents,
    sessions,
  };
  if (write) writeJson(root, resolve(root, ".project-to-act", "projections", "workload.json"), report);
  return report;
}

function buildReport(root, write = false) {
  const tasks = listTaskIds(root).map((id) => {
    const bundle = loadTaskBundle(root, id);
    const freshness = existsSync(bundle.paths.context)
      ? checkContext(root, id)
      : { fresh: false, reason: "missing-context" };
    const checkpointCount = existsSync(bundle.paths.events)
      ? readdirSync(bundle.paths.events)
          .filter((name) => name.endsWith(".json"))
          .map((name) => readJson(resolve(bundle.paths.events, name)))
          .filter((event) => event.type === "checkpoint").length
      : 0;
    const evidenceCount = existsSync(bundle.paths.evidence)
      ? readdirSync(bundle.paths.evidence).filter((name) => name.endsWith(".json")).length
      : 0;
    return {
      taskId: id,
      title: bundle.task.title,
      owner: bundle.status.owner || bundle.task.owner,
      state: bundle.status.state,
      revision: bundle.status.revision,
      branch: bundle.status.branch,
      contextFresh: freshness.fresh,
      intendedPaths: (bundle.intent.paths || []).length,
      intendedSymbols: (bundle.intent.symbols || []).length,
      checkpoints: checkpointCount,
      evidence: evidenceCount,
    };
  });
  const byState = {};
  const byOwner = {};
  for (const task of tasks) {
    byState[task.state] = (byState[task.state] || 0) + 1;
    byOwner[task.owner || "unassigned"] = (byOwner[task.owner || "unassigned"] || 0) + 1;
  }
  const report = {
    schemaVersion: 1,
    generatedAt: now(),
    totals: { tasks: tasks.length, active: tasks.filter((task) => ACTIVE_STATES.has(task.state)).length },
    byState,
    byOwner,
    conflicts: findConflicts(root),
    tasks,
  };
  if (write) writeJson(root, resolve(root, ".project-to-act", "projections", "progress.json"), report);
  return report;
}

function validateRepository(root) {
  const errors = [];
  const configPath = resolve(root, ".project-to-act", "COLLABORATION_CONFIG.json");
  if (!existsSync(configPath)) errors.push("缺少 .project-to-act/COLLABORATION_CONFIG.json；先运行 init");
  else {
    const config = readJson(configPath, "COLLABORATION_CONFIG.json");
    if (config.schemaVersion !== 1) errors.push("COLLABORATION_CONFIG.schemaVersion 必须为 1");
    if (!config.telemetryStore || !config.runtimeStore || config.telemetry?.schemaVersion !== 1)
      errors.push("COLLABORATION_CONFIG 缺少通用 telemetry/runtime 配置；运行 init --upgrade");
  }
  const sessions = listSessions(root);
  const sessionMap = new Map(sessions.map((session) => [session.sessionId, session]));
  const forbiddenTelemetryKeys = new Set([
    "prompt",
    "promptText",
    "chainOfThought",
    "reasoning",
    "transcript",
    "sourceCode",
    "secret",
  ]);
  for (const session of sessions) {
    if (session.schemaVersion !== 1) errors.push(`${session.sessionId}: session schemaVersion 必须为 1`);
    if (!session.taskId || !session.actorId || !session.executor || !session.startedAt)
      errors.push(`${session.sessionId}: 缺少 taskId、actorId、executor 或 startedAt`);
    for (const key of Object.keys(session)) {
      if (forbiddenTelemetryKeys.has(key)) errors.push(`${session.sessionId}: 禁止遥测字段 ${key}`);
    }
    if (session.status === "running" && session.endedAt)
      errors.push(`${session.sessionId}: running 会话不得有 endedAt`);
    if (session.status !== "running" && !session.endedAt) errors.push(`${session.sessionId}: 已结束会话缺少 endedAt`);
  }
  for (const id of listTaskIds(root)) {
    try {
      const bundle = loadTaskBundle(root, id);
      errors.push(
        ...validateTaskBundle(bundle, { active: ACTIVE_STATES.has(bundle.status.state) }).map(
          (error) => `${id}: ${error}`,
        ),
      );
      if (ACTIVE_STATES.has(bundle.status.state)) {
        const freshness = checkContext(root, id);
        if (!freshness.fresh)
          errors.push(
            `${id}: 上下文过期 (${freshness.changed.map((item) => item.path).join(", ") || freshness.reason})`,
          );
      }
      if (bundle.status.activeSessionId) {
        const session = sessionMap.get(bundle.status.activeSessionId);
        if (!session || session.taskId !== id || session.status !== "running")
          errors.push(`${id}: activeSessionId 未指向该任务的 running 会话`);
      }
    } catch (error) {
      errors.push(`${id}: ${error.message}`);
    }
  }
  for (const conflict of findConflicts(root))
    errors.push(`活动任务冲突 ${conflict.tasks.join(" <-> ")}: ${JSON.stringify(conflict.reasons)}`);
  return { valid: errors.length === 0, checkedAt: now(), tasks: listTaskIds(root).length, errors };
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  process.stdout.write(`Project-to-Act Collaboration CLI

Commands:
  init [--github] [--upgrade] [--project-root <path>]
  task create <ID> --title <title> --owner <owner>
  task transition <ID> --state <state> --expected-revision <N>
  context build <ID>
  context check <ID>
  intent check [ID]
  checkpoint <ID> --summary <text> --expected-revision <N>
  session start <ID> --actor <id> --executor <tool> --expected-revision <N>
  session heartbeat <session-id>
  session stop <session-id> --summary <text> --expected-revision <N>
  session list
  monitor report
  monitor export
  status [--json]
  report
  validate [--ci]
`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, subcommand, rawId] = positional;
  const root = projectRoot(flags);
  if (!command || command === "help") return usage();
  if (command === "init") return print(initRepository(root, flags));
  if (command === "task" && subcommand === "create") return print(createTask(root, taskId(rawId), flags));
  if (command === "task" && subcommand === "transition")
    return print(transitionTask(root, taskId(rawId), String(flags.state || ""), flags["expected-revision"]));
  if (command === "context" && subcommand === "build") return print(buildContext(root, taskId(rawId)));
  if (command === "context" && subcommand === "check") return print(checkContext(root, taskId(rawId)));
  if (command === "intent" && subcommand === "check") {
    const id = rawId ? taskId(rawId) : null;
    const conflicts = findConflicts(root, id, Boolean(id));
    print({ valid: conflicts.length === 0, conflicts });
    if (conflicts.length > 0) process.exitCode = 3;
    return;
  }
  if (command === "checkpoint") return print(checkpoint(root, taskId(subcommand), flags));
  if (command === "session" && subcommand === "start") return print(startSession(root, taskId(rawId), flags));
  if (command === "session" && subcommand === "heartbeat") return print(heartbeatSession(root, rawId));
  if (command === "session" && subcommand === "stop") return print(stopSession(root, rawId, flags));
  if (command === "session" && subcommand === "list") {
    const configPath = resolve(root, ".project-to-act", "COLLABORATION_CONFIG.json");
    const config = existsSync(configPath) ? mergedConfig(readJson(configPath)) : DEFAULT_CONFIG;
    return print(sessionStatus(root, config));
  }
  if (command === "monitor" && subcommand === "report") return print(monitorReport(root, false));
  if (command === "monitor" && subcommand === "export") return print(monitorReport(root, true));
  if (command === "status") return print(buildReport(root, false));
  if (command === "report") return print(buildReport(root, true));
  if (command === "validate") {
    const result = validateRepository(root);
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  fail("未知命令。运行 `pta.mjs help` 查看用法。", 2);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode || 1;
});
