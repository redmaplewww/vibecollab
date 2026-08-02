import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProjectOverview } from "./project-overview";

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hash(path: string) {
  return createHash("sha256").update(readFileSync(path, "utf8").replace(/\r\n?/gu, "\n"), "utf8").digest("hex");
}

function initializedProject() {
  const root = mkdtempSync(join(tmpdir(), "vibecollab-monitor-"));
  const taskRoot = join(root, ".project-to-act", "tasks", "VC-101");
  mkdirSync(join(taskRoot, "events"), { recursive: true });
  mkdirSync(join(root, ".project-to-act", "telemetry", "sessions"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "# fixture rules\n", "utf8");
  writeJson(join(root, "package.json"), { name: "fixture-project", version: "2.0.0" });
  writeFileSync(
    join(root, ".project-to-act", "PROJECT_FEATURES.md"),
    "| 功能 ID | 功能 | 优先级 | 状态 | 依赖 | 完成条件 | 证据 ID |\n| --- | --- | --- | --- | --- | --- | --- |\n| F-101 | 独立监控 | P0 | 进行中 | 无 | 可读取事实 | - |\n",
    "utf8",
  );
  writeJson(join(taskRoot, "TASK.json"), { schemaVersion: 1, taskId: "VC-101", title: "Monitor fixture" });
  writeJson(join(taskRoot, "STATUS.json"), {
    schemaVersion: 1,
    taskId: "VC-101",
    state: "in_progress",
    revision: 1,
    owner: "tester",
    branch: "task/vc-101",
    updatedAt: "2026-08-02T00:00:00.000Z",
    activeSessionId: null,
  });
  writeJson(join(taskRoot, "INTENT.json"), {
    schemaVersion: 1,
    taskId: "VC-101",
    paths: ["src/**"],
    symbols: [],
    contractsWrite: [],
    migrations: false,
  });
  writeJson(join(taskRoot, "CONTEXT.json"), {
    schemaVersion: 1,
    taskId: "VC-101",
    contextHash: "fixture-context",
    inputs: [{ path: "AGENTS.md", sha256: hash(join(root, "AGENTS.md")) }],
  });
  return root;
}

describe("registered project overview", () => {
  it("reads project, task and context facts from an initialized repository", () => {
    const root = initializedProject();
    const overview = buildProjectOverview({ id: "fixture", name: "Fixture", root });
    expect(overview.project).toMatchObject({
      name: "fixture-project",
      version: "2.0.0",
      featureTotals: { total: 1, active: 1 },
      taskTotals: { total: 1, active: 1 },
    });
    expect(overview.tasks[0]).toMatchObject({ id: "VC-101", context: { state: "fresh" } });
  });

  it("fails closed when a registered directory is not initialized", () => {
    const root = mkdtempSync(join(tmpdir(), "vibecollab-uninitialized-"));
    expect(() => buildProjectOverview({ id: "empty", name: "Empty", root })).toThrow(
      "Project is not initialized with Project-to-Act",
    );
  });
});
