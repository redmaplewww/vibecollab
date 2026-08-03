import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";
import type { RegisteredProject } from "./project-registry";

const actorSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/u);
const taskIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/u);
const shortText = z.string().trim().min(1).max(2_000);
const listText = z.string().trim().max(4_000).default("");

export const handoffActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish"),
    taskId: taskIdSchema,
    from: actorSchema,
    to: actorSchema,
    summary: shortText,
    nextAction: shortText,
    completed: listText,
    pending: listText,
    decisions: listText,
    checks: listText,
    verification: z.literal("passed"),
    expectedRevision: z.number().int().nonnegative(),
    syncGit: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("accept"),
    taskId: taskIdSchema,
    actor: actorSchema,
    executor: actorSchema,
    syncGit: z.boolean().default(true),
  }),
]);

export type HandoffAction = z.infer<typeof handoffActionSchema>;

function valueArgs(flag: string, value: string | number) {
  return [`--${flag}`, String(value)];
}

export function runHandoffAction(project: RegisteredProject, raw: unknown) {
  const action = handoffActionSchema.parse(raw);
  const cli = resolve(process.cwd(), "skills", "project-to-act-collaboration", "scripts", "pta.mjs");
  const args = [cli, "handoff", action.action, action.taskId];
  if (action.action === "publish") {
    args.push(
      ...valueArgs("from", action.from),
      ...valueArgs("to", action.to),
      ...valueArgs("summary", action.summary),
      ...valueArgs("next-action", action.nextAction),
      ...valueArgs("completed", action.completed),
      ...valueArgs("pending", action.pending),
      ...valueArgs("decisions", action.decisions),
      ...valueArgs("checks", action.checks),
      ...valueArgs("verification", action.verification),
      ...valueArgs("expected-revision", action.expectedRevision),
    );
    if (action.syncGit) args.push("--push");
  } else {
    args.push(...valueArgs("actor", action.actor), ...valueArgs("executor", action.executor));
    if (action.syncGit) args.push("--pull", "--push");
  }
  args.push("--project-root", project.root);
  const result = spawnSync(process.execPath, args, {
    cwd: project.root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 90_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = String(result.stderr || result.stdout || "handoff command failed").trim();
    const error = new Error(message);
    Object.assign(error, { code: "handoff_rejected", exitCode: result.status });
    throw error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("handoff command returned invalid JSON");
  }
}
