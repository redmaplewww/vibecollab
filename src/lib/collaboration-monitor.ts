import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  collaborationOverviewSchema,
  featureStateSchema,
  taskStateSchema,
  type CollaborationOverview,
} from "./collaboration-contracts";

type JsonObject = Record<string, unknown>;
type Warning = CollaborationOverview["warnings"][number];
type WorkloadBucket = {
  sessions: number;
  active: number;
  elapsedSeconds: number;
  tasks: Set<string>;
  verifiedGit: { sessions: number; commits: number; files: number; additions: number; deletions: number };
  toolReported: {
    sessions: number;
    testsPassed: number | null;
    testsFailed: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
    costUsd: number | null;
  };
};

const ACTIVE_STATES = new Set(["ready", "in_progress", "blocked", "review"]);
const FEATURE_STATES = new Set(featureStateSchema.options);

function safeJson(path: string, warnings: Warning[], label: string): JsonObject | null {
  if (!existsSync(path)) {
    warnings.push({ code: "missing-file", message: `${label} 不存在`, severity: "warning" });
    return null;
  }
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("root must be an object");
    return value as JsonObject;
  } catch {
    warnings.push({ code: "invalid-json", message: `${label} 无法解析，已跳过`, severity: "warning" });
    return null;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sha256File(path: string) {
  const raw = readFileSync(path);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    if (!text.includes("\0")) return createHash("sha256").update(text.replace(/\r\n?/gu, "\n"), "utf8").digest("hex");
  } catch {
    // Binary context inputs remain byte exact.
  }
  return createHash("sha256").update(raw).digest("hex");
}

function readFeatures(root: string, warnings: Warning[]): CollaborationOverview["features"] {
  const path = join(root, ".project-to-act", "PROJECT_FEATURES.md");
  if (!existsSync(path)) {
    warnings.push({ code: "features-missing", message: "功能账本不存在", severity: "critical" });
    return [];
  }
  const rows = readFileSync(path, "utf8").split(/\r?\n/u);
  const features: CollaborationOverview["features"] = [];
  for (const row of rows) {
    if (!/^\|\s*F-[\w-]+\s*\|/u.test(row)) continue;
    const cells = row
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 7 || !FEATURE_STATES.has(cells[3] as never)) {
      warnings.push({
        code: "feature-row-invalid",
        message: `无法解析功能行 ${cells[0] || "unknown"}`,
        severity: "warning",
      });
      continue;
    }
    features.push({
      id: cells[0],
      title: cells[1],
      priority: cells[2],
      state: featureStateSchema.parse(cells[3]),
      dependencies:
        cells[4] === "无"
          ? []
          : cells[4]
              .split(/[、,]/u)
              .map((item) => item.trim())
              .filter(Boolean),
      completion: cells[5],
      evidenceId: cells[6] && cells[6] !== "-" ? cells[6] : null,
    });
  }
  return features;
}

function pathPrefix(value: string) {
  const normalized = value.replace(/\\/gu, "/").replace(/^\.\//u, "");
  const wildcard = normalized.search(/[?*[]/u);
  return (wildcard >= 0 ? normalized.slice(0, wildcard) : normalized).replace(/\/+$/u, "");
}

function pathsOverlap(left: string, right: string) {
  const a = pathPrefix(left);
  const b = pathPrefix(right);
  return !a || !b || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function readTasks(root: string, warnings: Warning[]) {
  const store = join(root, ".project-to-act", "tasks");
  if (!existsSync(store)) {
    warnings.push({ code: "tasks-missing", message: "任务目录不存在", severity: "critical" });
    return { tasks: [] as CollaborationOverview["tasks"], intents: new Map<string, JsonObject>() };
  }
  const tasks: CollaborationOverview["tasks"] = [];
  const intents = new Map<string, JsonObject>();
  for (const entry of readdirSync(store, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const taskRoot = join(store, entry.name);
    const task = safeJson(join(taskRoot, "TASK.json"), warnings, `${entry.name}/TASK.json`);
    const status = safeJson(join(taskRoot, "STATUS.json"), warnings, `${entry.name}/STATUS.json`);
    const intent = safeJson(join(taskRoot, "INTENT.json"), warnings, `${entry.name}/INTENT.json`);
    if (!task || !status || !intent || !taskStateSchema.safeParse(status.state).success) {
      warnings.push({
        code: "task-skipped",
        message: `${entry.name} 的任务契约不完整，未纳入统计`,
        severity: "warning",
      });
      continue;
    }
    intents.set(entry.name, intent);
    const contextPath = join(taskRoot, "CONTEXT.json");
    const context = existsSync(contextPath) ? safeJson(contextPath, warnings, `${entry.name}/CONTEXT.json`) : null;
    const changedPaths: string[] = [];
    let contextState: "fresh" | "stale" | "missing" | "unavailable" = context ? "fresh" : "missing";
    if (context && Array.isArray(context.inputs)) {
      try {
        for (const input of context.inputs as JsonObject[]) {
          const inputPath = stringValue(input.path);
          const expected = stringValue(input.sha256);
          if (!inputPath || !expected) continue;
          const absolute = resolve(root, inputPath);
          const inside = relative(root, absolute);
          if (inside.startsWith("..") || !existsSync(absolute) || sha256File(absolute) !== expected)
            changedPaths.push(inputPath);
        }
        if (changedPaths.length) contextState = "stale";
      } catch {
        contextState = "unavailable";
      }
    }
    const countFiles = (name: string) => {
      const path = join(taskRoot, name);
      return existsSync(path) ? readdirSync(path).filter((item) => item.endsWith(".json")).length : 0;
    };
    const eventPath = join(taskRoot, "events");
    let checkpoints = 0;
    if (existsSync(eventPath)) {
      for (const name of readdirSync(eventPath).filter((item) => item.endsWith(".json"))) {
        const event = safeJson(join(eventPath, name), warnings, `${entry.name}/events/${name}`);
        if (event?.type === "checkpoint") checkpoints += 1;
      }
    }
    const activeSessionId = stringValue(status.activeSessionId);
    const activeSession = activeSessionId
      ? safeJson(
          join(root, ".project-to-act", "telemetry", "sessions", `${activeSessionId}.json`),
          [],
          `${entry.name} active session`,
        )
      : null;
    const handoffRaw = existsSync(join(taskRoot, "HANDOFF.json"))
      ? safeJson(join(taskRoot, "HANDOFF.json"), warnings, `${entry.name}/HANDOFF.json`)
      : null;
    let handoff: CollaborationOverview["tasks"][number]["handoff"] = null;
    if (handoffRaw) {
      const handoffState = handoffRaw.state === "accepted" ? "accepted" : "published";
      const handoffBranch = stringValue(handoffRaw.branch) ?? "";
      const codeSha = stringValue(handoffRaw.codeSha) ?? "";
      const taskRevision = Math.trunc(numberValue(handoffRaw.taskRevision) ?? 0);
      const acceptedRevision =
        numberValue(handoffRaw.acceptedRevision) === null
          ? null
          : Math.trunc(numberValue(handoffRaw.acceptedRevision)!);
      const expectedRevision = handoffState === "accepted" ? acceptedRevision : taskRevision;
      const handoffContext = stringValue(handoffRaw.contextHash) ?? "";
      const verification = (handoffRaw.verification as JsonObject | null)?.status;
      const branchMatches = Boolean(handoffBranch && gitCommand(root, ["branch", "--show-current"]) === handoffBranch);
      const codeMatches = Boolean(
        codeSha && gitCommand(root, ["merge-base", "--is-ancestor", codeSha, "HEAD"]) !== null,
      );
      const revisionMatches =
        expectedRevision !== null && expectedRevision === Math.trunc(numberValue(status.revision) ?? 0);
      const contextMatches = Boolean(
        handoffContext &&
        handoffContext === stringValue(status.contextHash) &&
        handoffContext === stringValue(context?.contextHash),
      );
      const verificationPassed = verification === "passed";
      handoff = {
        id: stringValue(handoffRaw.handoffId) ?? "invalid",
        state: handoffState,
        from: stringValue(handoffRaw.from) ?? "unknown",
        to: stringValue(handoffRaw.to) ?? "unknown",
        branch: handoffBranch,
        codeSha,
        taskRevision,
        contextHash: handoffContext,
        summary: stringValue(handoffRaw.summary) ?? "",
        completed: stringArray(handoffRaw.completed),
        pending: stringArray(handoffRaw.pending),
        decisions: stringArray(handoffRaw.decisions),
        nextAction: stringValue(handoffRaw.nextAction) ?? "",
        verificationStatus: ["passed", "failed", "not-run"].includes(String(verification))
          ? (verification as "passed" | "failed" | "not-run")
          : "unknown",
        publishedAt: stringValue(handoffRaw.publishedAt) ?? new Date(0).toISOString(),
        acceptedBy: stringValue(handoffRaw.acceptedBy),
        acceptedAt: stringValue(handoffRaw.acceptedAt),
        acceptedRevision,
        consistency: {
          branch: branchMatches,
          code: codeMatches,
          revision: revisionMatches,
          context: contextMatches && contextState === "fresh",
          verification: verificationPassed,
          ready:
            branchMatches &&
            codeMatches &&
            revisionMatches &&
            contextMatches &&
            contextState === "fresh" &&
            verificationPassed,
        },
      };
    }
    tasks.push({
      id: entry.name,
      title: stringValue(task.title) ?? entry.name,
      owner: stringValue(status.owner) ?? stringValue(task.owner),
      state: taskStateSchema.parse(status.state),
      revision: Math.max(0, Math.trunc(numberValue(status.revision) ?? 0)),
      branch: stringValue(status.branch),
      updatedAt: stringValue(status.updatedAt),
      context: { state: contextState, hash: context ? stringValue(context.contextHash) : null, changedPaths },
      intent: {
        pathCount: stringArray(intent.paths).length,
        symbolCount: stringArray(intent.symbols).length,
        writesContracts: stringArray(intent.contractsWrite),
        migrations: intent.migrations === true,
      },
      activeSessionId,
      currentActor: stringValue(status.currentActor) ?? stringValue(activeSession?.actorId),
      handoff,
      checkpoints,
      evidence: countFiles("evidence"),
    });
  }
  return { tasks: tasks.sort((a, b) => b.id.localeCompare(a.id)), intents };
}

function findConflicts(tasks: CollaborationOverview["tasks"], intents: Map<string, JsonObject>) {
  const active = tasks.filter((task) => ACTIVE_STATES.has(task.state));
  const conflicts: CollaborationOverview["conflicts"] = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = intents.get(active[i].id) ?? {};
      const right = intents.get(active[j].id) ?? {};
      const reasons: string[] = [];
      for (const a of stringArray(left.paths)) {
        for (const b of stringArray(right.paths)) if (pathsOverlap(a, b)) reasons.push(`路径重叠：${a} ↔ ${b}`);
      }
      for (const field of ["symbols", "contractsWrite"] as const) {
        const other = new Set(stringArray(right[field]));
        for (const value of stringArray(left[field])) if (other.has(value)) reasons.push(`${field}：${value}`);
      }
      if (left.migrations === true && right.migrations === true) reasons.push("迁移序列冲突");
      if (reasons.length) conflicts.push({ tasks: [active[i].id, active[j].id], reasons: [...new Set(reasons)] });
    }
  }
  return conflicts;
}

function emptyBucket(): WorkloadBucket {
  return {
    sessions: 0,
    active: 0,
    elapsedSeconds: 0,
    tasks: new Set(),
    verifiedGit: { sessions: 0, commits: 0, files: 0, additions: 0, deletions: 0 },
    toolReported: { sessions: 0, testsPassed: null, testsFailed: null, tokensIn: null, tokensOut: null, costUsd: null },
  };
}

function addMetric(current: number | null, value: unknown) {
  const parsed = numberValue(value);
  return parsed === null ? current : (current ?? 0) + parsed;
}

function addSession(bucket: WorkloadBucket, session: JsonObject) {
  bucket.sessions += 1;
  if (session.status === "running") bucket.active += 1;
  bucket.elapsedSeconds += Math.trunc(numberValue(session.elapsedSeconds) ?? 0);
  const taskId = stringValue(session.taskId);
  if (taskId) bucket.tasks.add(taskId);
  const git = session.gitMetrics as JsonObject | null;
  if (git?.available === true) {
    bucket.verifiedGit.sessions += 1;
    for (const key of ["commits", "files", "additions", "deletions"] as const)
      bucket.verifiedGit[key] += Math.trunc(numberValue(git[key]) ?? 0);
  }
  const tool = session.toolReported as JsonObject | null;
  if (tool) {
    bucket.toolReported.sessions += 1;
    for (const key of ["testsPassed", "testsFailed", "tokensIn", "tokensOut", "costUsd"] as const)
      bucket.toolReported[key] = addMetric(bucket.toolReported[key], tool[key]);
  }
}

function readWorkload(root: string, warnings: Warning[]): CollaborationOverview["workload"] {
  const telemetry = join(root, ".project-to-act", "telemetry", "sessions");
  const runtime = join(root, ".project-to-act", "runtime", "sessions");
  const sessions: JsonObject[] = [];
  if (existsSync(telemetry)) {
    for (const name of readdirSync(telemetry).filter((item) => item.endsWith(".json"))) {
      const session = safeJson(join(telemetry, name), warnings, `telemetry/${name}`);
      if (session) sessions.push(session);
    }
  } else warnings.push({ code: "telemetry-missing", message: "暂无工作会话遥测", severity: "info" });
  const totals = emptyBucket();
  const actors = new Map<string, WorkloadBucket>();
  const executors = new Map<string, WorkloadBucket>();
  const now = Date.now();
  const mappedSessions: CollaborationOverview["workload"]["sessions"] = [];
  for (const session of sessions) {
    const id = stringValue(session.sessionId);
    const taskId = stringValue(session.taskId);
    const actorId = stringValue(session.actorId);
    const executor = stringValue(session.executor);
    const startedAt = stringValue(session.startedAt);
    const status = session.status;
    if (
      !id ||
      !taskId ||
      !actorId ||
      !executor ||
      !startedAt ||
      !["running", "completed", "aborted"].includes(String(status))
    )
      continue;
    actors.set(actorId, actors.get(actorId) ?? emptyBucket());
    executors.set(executor, executors.get(executor) ?? emptyBucket());
    addSession(totals, session);
    addSession(actors.get(actorId)!, session);
    addSession(executors.get(executor)!, session);
    let presence: "online" | "stale" | "unknown" | "ended" = status === "running" ? "unknown" : "ended";
    if (status === "running") {
      const heartbeat = safeJson(join(runtime, `${id}.json`), [], `${id} runtime`);
      const heartbeatAt = heartbeat ? stringValue(heartbeat.heartbeatAt) : null;
      if (heartbeatAt) presence = now - new Date(heartbeatAt).getTime() > 180_000 ? "stale" : "online";
    }
    const tool = session.toolReported as JsonObject | null;
    mappedSessions.push({
      id,
      taskId,
      actorId,
      executor,
      status: status as "running" | "completed" | "aborted",
      presence,
      startedAt,
      endedAt: stringValue(session.endedAt),
      elapsedSeconds:
        numberValue(session.elapsedSeconds) === null ? null : Math.trunc(numberValue(session.elapsedSeconds)!),
      testsPassed: tool ? numberValue(tool.testsPassed) : null,
      testsFailed: tool ? numberValue(tool.testsFailed) : null,
      gitAvailable: (session.gitMetrics as JsonObject | null)?.available === true,
    });
  }
  const summarize = ([id, bucket]: [string, WorkloadBucket]) => ({
    id,
    sessions: bucket.sessions,
    active: bucket.active,
    elapsedSeconds: bucket.elapsedSeconds,
    tasks: [...bucket.tasks].sort(),
    verifiedFiles: bucket.verifiedGit.files,
    testsPassed: bucket.toolReported.testsPassed,
    testsFailed: bucket.toolReported.testsFailed,
  });
  return {
    semantics: {
      elapsedSeconds: "tracked session elapsed time; not focused work time",
      verifiedGit: "change volume; not value or performance",
      toolReported: "optional executor-provided data; may be incomplete",
    },
    totals: {
      sessions: totals.sessions,
      active: totals.active,
      elapsedSeconds: totals.elapsedSeconds,
      verifiedGit: totals.verifiedGit,
      toolReported: totals.toolReported,
    },
    byActor: [...actors.entries()].map(summarize).sort((a, b) => b.sessions - a.sessions),
    byExecutor: [...executors.entries()].map(summarize).sort((a, b) => b.sessions - a.sessions),
    sessions: mappedSessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  };
}

function gitCommand(root: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function readGit(root: string, warnings: Warning[]): CollaborationOverview["git"] {
  const headSha = gitCommand(root, ["rev-parse", "HEAD"]);
  if (!headSha) {
    warnings.push({ code: "git-unavailable", message: "Git 状态不可用", severity: "warning" });
    return {
      available: false,
      branch: null,
      headSha: null,
      staged: null,
      unstaged: null,
      untracked: null,
      changedFiles: [],
      worktrees: [],
      recentCommits: [],
    };
  }
  const porcelain = gitCommand(root, ["status", "--porcelain=v1", "-uall"]) ?? "";
  const changedFiles = porcelain
    .split(/\r?\n/u)
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => ({
      indexStatus: line[0] ?? " ",
      worktreeStatus: line[1] ?? " ",
      path: line.slice(3).replace(/^.* -> /u, ""),
    }));
  const worktreeRaw = gitCommand(root, ["worktree", "list", "--porcelain"]) ?? "";
  const worktrees: CollaborationOverview["git"]["worktrees"] = [];
  for (const block of worktreeRaw.split(/\r?\n\r?\n/u).filter(Boolean)) {
    const fields = new Map(
      block.split(/\r?\n/u).map((line) => {
        const space = line.indexOf(" ");
        return space < 0 ? [line, ""] : [line.slice(0, space), line.slice(space + 1)];
      }),
    );
    worktrees.push({
      path: fields.get("worktree") ?? "unknown",
      branch: fields.get("branch")?.replace(/^refs\/heads\//u, "") || null,
      headSha: fields.get("HEAD") || null,
      bare: fields.has("bare"),
    });
  }
  const log = gitCommand(root, ["log", "-8", "--date=iso-strict", "--pretty=format:%h%x1f%aI%x1f%an%x1f%s"]) ?? "";
  const recentCommits = log
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const [sha, authoredAt, author, subject] = line.split("\u001f");
      return { sha, authoredAt: new Date(authoredAt).toISOString(), author, subject };
    })
    .filter((commit) => commit.sha && commit.authoredAt && commit.author && commit.subject);
  return {
    available: true,
    branch: gitCommand(root, ["branch", "--show-current"]),
    headSha,
    staged: changedFiles.filter((file) => file.indexStatus !== " " && file.indexStatus !== "?").length,
    unstaged: changedFiles.filter((file) => file.worktreeStatus !== " " && file.worktreeStatus !== "?").length,
    untracked: changedFiles.filter((file) => file.indexStatus === "?" && file.worktreeStatus === "?").length,
    changedFiles,
    worktrees,
    recentCommits,
  };
}

export function buildCollaborationOverview(projectRoot = process.cwd()): CollaborationOverview {
  const root = resolve(projectRoot);
  const warnings: Warning[] = [];
  const packageJson = safeJson(join(root, "package.json"), warnings, "package.json");
  const features = readFeatures(root, warnings);
  const { tasks, intents } = readTasks(root, warnings);
  const completedFeatures = features.filter((feature) => feature.state === "已完成").length;
  const overview: CollaborationOverview = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      name: stringValue(packageJson?.name) ?? root.split(/[\\/]/u).at(-1) ?? "project",
      version: stringValue(packageJson?.version),
      featureTotals: {
        total: features.length,
        completed: completedFeatures,
        active: features.filter((feature) => feature.state === "进行中").length,
        blocked: features.filter((feature) => feature.state === "已阻塞").length,
        completionPercent: features.length ? Math.round((completedFeatures / features.length) * 100) : 0,
      },
      taskTotals: {
        total: tasks.length,
        active: tasks.filter((task) => ACTIVE_STATES.has(task.state)).length,
        done: tasks.filter((task) => task.state === "done").length,
        blocked: tasks.filter((task) => task.state === "blocked").length,
      },
    },
    features,
    tasks,
    conflicts: findConflicts(tasks, intents),
    workload: readWorkload(root, warnings),
    git: readGit(root, warnings),
    warnings,
  };
  if (overview.conflicts.length)
    warnings.push({
      code: "intent-conflict",
      message: `发现 ${overview.conflicts.length} 组活动任务意图冲突`,
      severity: "critical",
    });
  const stale = tasks.filter((task) => ACTIVE_STATES.has(task.state) && task.context.state !== "fresh").length;
  if (stale)
    warnings.push({ code: "context-stale", message: `${stale} 个活动任务上下文不是最新`, severity: "critical" });
  return collaborationOverviewSchema.parse(overview);
}
