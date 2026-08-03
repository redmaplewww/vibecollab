import { z } from "zod";

export const taskStateSchema = z.enum(["draft", "ready", "in_progress", "blocked", "review", "done", "cancelled"]);

export const featureStateSchema = z.enum(["候选", "已规划", "进行中", "已阻塞", "已完成", "已取消"]);

const nullableMetricSchema = z.number().finite().nonnegative().nullable();

export const collaborationOverviewSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  project: z.object({
    name: z.string(),
    version: z.string().nullable(),
    featureTotals: z.object({
      total: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      completionPercent: z.number().min(0).max(100),
    }),
    taskTotals: z.object({
      total: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      done: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
    }),
  }),
  features: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      priority: z.string(),
      state: featureStateSchema,
      dependencies: z.array(z.string()),
      completion: z.string(),
      evidenceId: z.string().nullable(),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      owner: z.string().nullable(),
      state: taskStateSchema,
      revision: z.number().int().nonnegative(),
      branch: z.string().nullable(),
      updatedAt: z.string().datetime().nullable(),
      context: z.object({
        state: z.enum(["fresh", "stale", "missing", "unavailable"]),
        hash: z.string().nullable(),
        changedPaths: z.array(z.string()),
      }),
      intent: z.object({
        pathCount: z.number().int().nonnegative(),
        symbolCount: z.number().int().nonnegative(),
        writesContracts: z.array(z.string()),
        migrations: z.boolean(),
      }),
      activeSessionId: z.string().nullable(),
      currentActor: z.string().nullable(),
      handoff: z
        .object({
          id: z.string(),
          state: z.enum(["published", "accepted"]),
          from: z.string(),
          to: z.string(),
          branch: z.string(),
          codeSha: z.string(),
          taskRevision: z.number().int().nonnegative(),
          contextHash: z.string(),
          summary: z.string(),
          completed: z.array(z.string()),
          pending: z.array(z.string()),
          decisions: z.array(z.string()),
          nextAction: z.string(),
          verificationStatus: z.enum(["passed", "failed", "not-run", "unknown"]),
          publishedAt: z.string().datetime(),
          acceptedBy: z.string().nullable(),
          acceptedAt: z.string().datetime().nullable(),
          acceptedRevision: z.number().int().nonnegative().nullable(),
          consistency: z.object({
            branch: z.boolean(),
            code: z.boolean(),
            revision: z.boolean(),
            context: z.boolean(),
            verification: z.boolean(),
            ready: z.boolean(),
          }),
        })
        .nullable(),
      checkpoints: z.number().int().nonnegative(),
      evidence: z.number().int().nonnegative(),
    }),
  ),
  conflicts: z.array(
    z.object({
      tasks: z.tuple([z.string(), z.string()]),
      reasons: z.array(z.string()),
    }),
  ),
  workload: z.object({
    semantics: z.object({
      elapsedSeconds: z.string(),
      verifiedGit: z.string(),
      toolReported: z.string(),
    }),
    totals: z.object({
      sessions: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      elapsedSeconds: z.number().int().nonnegative(),
      verifiedGit: z.object({
        sessions: z.number().int().nonnegative(),
        commits: z.number().int().nonnegative(),
        files: z.number().int().nonnegative(),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
      }),
      toolReported: z.object({
        sessions: z.number().int().nonnegative(),
        testsPassed: nullableMetricSchema,
        testsFailed: nullableMetricSchema,
        tokensIn: nullableMetricSchema,
        tokensOut: nullableMetricSchema,
        costUsd: nullableMetricSchema,
      }),
    }),
    byActor: z.array(
      z.object({
        id: z.string(),
        sessions: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        elapsedSeconds: z.number().int().nonnegative(),
        tasks: z.array(z.string()),
        verifiedFiles: z.number().int().nonnegative(),
        testsPassed: nullableMetricSchema,
        testsFailed: nullableMetricSchema,
      }),
    ),
    byExecutor: z.array(
      z.object({
        id: z.string(),
        sessions: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        elapsedSeconds: z.number().int().nonnegative(),
        tasks: z.array(z.string()),
        verifiedFiles: z.number().int().nonnegative(),
        testsPassed: nullableMetricSchema,
        testsFailed: nullableMetricSchema,
      }),
    ),
    sessions: z.array(
      z.object({
        id: z.string(),
        taskId: z.string(),
        actorId: z.string(),
        executor: z.string(),
        status: z.enum(["running", "completed", "aborted"]),
        presence: z.enum(["online", "stale", "unknown", "ended"]),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime().nullable(),
        elapsedSeconds: z.number().int().nonnegative().nullable(),
        testsPassed: nullableMetricSchema,
        testsFailed: nullableMetricSchema,
        gitAvailable: z.boolean(),
      }),
    ),
  }),
  git: z.object({
    available: z.boolean(),
    branch: z.string().nullable(),
    headSha: z.string().nullable(),
    staged: z.number().int().nonnegative().nullable(),
    unstaged: z.number().int().nonnegative().nullable(),
    untracked: z.number().int().nonnegative().nullable(),
    changedFiles: z.array(
      z.object({
        path: z.string(),
        indexStatus: z.string(),
        worktreeStatus: z.string(),
      }),
    ),
    worktrees: z.array(
      z.object({
        path: z.string(),
        branch: z.string().nullable(),
        headSha: z.string().nullable(),
        bare: z.boolean(),
      }),
    ),
    recentCommits: z.array(
      z.object({
        sha: z.string(),
        authoredAt: z.string().datetime(),
        author: z.string(),
        subject: z.string(),
      }),
    ),
  }),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
    }),
  ),
});

export type CollaborationOverview = z.infer<typeof collaborationOverviewSchema>;
