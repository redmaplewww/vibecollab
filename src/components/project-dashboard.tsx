"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CloudDownload,
  CloudUpload,
  Code2,
  GitCommitHorizontal,
  RefreshCw,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import type { CollaborationOverview } from "@/lib/collaboration-contracts";
import type { RegisteredProject } from "@/lib/project-registry";

const taskLabels: Record<string, string> = {
  draft: "草稿",
  ready: "就绪",
  in_progress: "开发中",
  blocked: "阻塞",
  review: "评审",
  done: "完成",
  cancelled: "取消",
};

type ActionState = "idle" | "submitting" | "success" | "error";

function shortSha(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "不可用";
}

export function ProjectDashboard({
  project,
  overview,
}: {
  project: RegisteredProject;
  overview: CollaborationOverview;
}) {
  const currentTask = useMemo(
    () =>
      overview.tasks.find((task) => task.handoff?.state === "published") ??
      overview.tasks.find((task) => task.activeSessionId) ??
      overview.tasks.find((task) => ["in_progress", "ready", "review", "blocked"].includes(task.state)) ??
      overview.tasks[0] ??
      null,
    [overview.tasks],
  );
  const handoff = currentTask?.handoff ?? null;
  const taskCanPublish = currentTask?.state === "in_progress";
  const [mode, setMode] = useState<"publish" | "accept">(handoff?.state === "published" ? "accept" : "publish");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [syncGit, setSyncGit] = useState(true);
  const [verified, setVerified] = useState(false);
  const [from, setFrom] = useState(currentTask?.currentActor ?? currentTask?.owner ?? "");
  const [to, setTo] = useState(handoff?.to === "any" ? "" : (handoff?.to ?? ""));
  const [actor, setActor] = useState(handoff?.to === "any" ? "" : (handoff?.to ?? ""));
  const [executor, setExecutor] = useState("cursor");
  const [summary, setSummary] = useState(handoff?.summary ?? "");
  const [completed, setCompleted] = useState(handoff?.completed.join("; ") ?? "");
  const [pending, setPending] = useState(handoff?.pending.join("; ") ?? "");
  const [decisions, setDecisions] = useState(handoff?.decisions.join("; ") ?? "");
  const [nextAction, setNextAction] = useState(handoff?.nextAction ?? "");
  const [checks, setChecks] = useState("");

  const consistency = [
    {
      label: "代码版本",
      value: handoff ? handoff.consistency.code : Boolean(overview.git.headSha),
      detail: shortSha(handoff?.codeSha ?? overview.git.headSha),
    },
    {
      label: "任务进度",
      value: handoff ? handoff.consistency.revision : Boolean(currentTask),
      detail: currentTask ? `revision ${currentTask.revision}` : "无任务",
    },
    {
      label: "AI 上下文",
      value: handoff ? handoff.consistency.context : currentTask?.context.state === "fresh",
      detail: shortSha(handoff?.contextHash ?? currentTask?.context.hash),
    },
    {
      label: "验证结果",
      value: handoff ? handoff.consistency.verification : false,
      detail: handoff?.verificationStatus ?? "尚未发布",
    },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentTask) return;
    setActionState("submitting");
    setMessage("");
    const body =
      mode === "publish"
        ? {
            action: "publish",
            taskId: currentTask.id,
            from,
            to,
            summary,
            completed,
            pending,
            decisions,
            nextAction,
            checks,
            verification: verified ? "passed" : "not-run",
            expectedRevision: currentTask.revision,
            syncGit,
          }
        : { action: "accept", taskId: currentTask.id, actor, executor, syncGit };
    try {
      const response = await fetch(`/api/projects/${project.id}/handoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "交接失败");
      setActionState("success");
      setMessage(mode === "publish" ? "进度已发布，写入权已释放。" : "进度已接收，你现在是唯一写入者。");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setActionState("error");
      setMessage(error instanceof Error ? error.message : "交接失败");
    }
  }

  if (!currentTask) {
    return (
      <div className="shell dashboard">
        <div className="breadcrumb">
          <Link href="/">
            <ArrowLeft size={13} />
            全部项目
          </Link>
        </div>
        <section className="handoff-empty">
          <ShieldAlert size={24} />
          <h1>还没有可接力的 Task</h1>
          <p>先在仓库中创建 Task Contract，再回到这里同步。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="shell dashboard handoff-dashboard">
      <div className="breadcrumb">
        <Link href="/">
          <ArrowLeft size={13} />
          全部项目
        </Link>
        <span>/</span>
        <strong>{project.name}</strong>
      </div>

      <header className="dashboard-head handoff-head">
        <div>
          <p className="eyebrow">ONE TASK · ONE WRITER · CONTINUOUS CONTEXT</p>
          <h1>同一任务，顺序接力</h1>
          <p>
            {project.name} · {project.root}
          </p>
        </div>
        <button type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={14} />
          刷新同步状态
        </button>
      </header>

      <section className="handoff-lane" aria-label="当前任务接力状态">
        <div className="lane-person">
          <span>
            <UserRound size={18} />
          </span>
          <small>
            {handoff?.state === "published" ? "上一位开发者" : currentTask.currentActor ? "当前写入者" : "任务负责人"}
          </small>
          <strong>{handoff?.from ?? currentTask.currentActor ?? currentTask.owner ?? "未分配"}</strong>
        </div>
        <div className={`lane-baton ${handoff?.state ?? "working"}`}>
          <div>
            <GitCommitHorizontal size={16} />
            <code>{shortSha(handoff?.codeSha ?? overview.git.headSha)}</code>
          </div>
          <span>
            <i />
            <i />
            <i />
          </span>
          <strong>
            {handoff?.state === "published"
              ? "等待接收"
              : handoff?.state === "accepted"
                ? "已接管"
                : currentTask.state === "done"
                  ? "任务已完成"
                  : "开发进行中"}
          </strong>
        </div>
        <ArrowRight className="lane-arrow" size={18} />
        <div className="lane-person receiver">
          <span>
            <UserRound size={18} />
          </span>
          <small>{handoff?.state === "accepted" ? "当前写入者" : "下一位开发者"}</small>
          <strong>{handoff?.acceptedBy ?? (handoff?.to === "any" ? "待认领" : handoff?.to) ?? "待指定"}</strong>
        </div>
      </section>

      <section className="task-focus">
        <div className="task-identity">
          <span className={`state ${currentTask.state}`}>{taskLabels[currentTask.state]}</span>
          <p className="eyebrow">CURRENT TASK</p>
          <h2>
            <code>{currentTask.id}</code>
            {currentTask.title}
          </h2>
          <dl>
            <div>
              <dt>任务分支</dt>
              <dd>{currentTask.branch ?? "未记录"}</dd>
            </div>
            <div>
              <dt>当前负责人</dt>
              <dd>{currentTask.currentActor ?? "写入权已释放"}</dd>
            </div>
            <div>
              <dt>最后更新</dt>
              <dd>
                {currentTask.updatedAt
                  ? new Date(currentTask.updatedAt).toLocaleString("zh-CN", { hour12: false })
                  : "未知"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="consistency-seal">
          <header>
            <ClipboardCheck size={17} />
            <div>
              <strong>双方一致性封印</strong>
              <small>全部通过后才允许接管</small>
            </div>
          </header>
          <div className="seal-grid">
            {consistency.map((item) => (
              <div className={item.value ? "passed" : "failed"} key={item.label}>
                <span>{item.value ? <Check size={13} /> : <X size={13} />}</span>
                <strong>{item.label}</strong>
                <code>{item.detail}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {handoff && (
        <section className="handoff-brief">
          <header>
            <div>
              <p className="eyebrow">HANDOFF BRIEF</p>
              <h2>上一次工作留下了什么</h2>
            </div>
            <code>{handoff.id}</code>
          </header>
          <div className="brief-summary">
            <strong>当前结果</strong>
            <p>{handoff.summary}</p>
          </div>
          <div className="brief-columns">
            <div>
              <strong>已经完成</strong>
              {handoff.completed.length ? (
                <ul>
                  {handoff.completed.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>未记录</p>
              )}
            </div>
            <div>
              <strong>仍需完成</strong>
              {handoff.pending.length ? (
                <ul>
                  {handoff.pending.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>未记录</p>
              )}
            </div>
            <div>
              <strong>必须保持的决策</strong>
              {handoff.decisions.length ? (
                <ul>
                  {handoff.decisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>未记录</p>
              )}
            </div>
          </div>
          <footer>
            <ArrowRight size={15} />
            <span>
              <small>NEXT ACTION</small>
              <strong>{handoff.nextAction}</strong>
            </span>
          </footer>
        </section>
      )}

      <section className="handoff-action-panel">
        <header>
          <div>
            <p className="eyebrow">SYNC ACTION</p>
            <h2>{mode === "publish" ? "发布我的进度" : "接收并继续开发"}</h2>
          </div>
          <div className="action-tabs" role="tablist">
            <button className={mode === "publish" ? "selected" : ""} type="button" onClick={() => setMode("publish")}>
              <CloudUpload size={14} />
              发布进度
            </button>
            <button className={mode === "accept" ? "selected" : ""} type="button" onClick={() => setMode("accept")}>
              <CloudDownload size={14} />
              接收进度
            </button>
          </div>
        </header>
        <form onSubmit={submit}>
          {mode === "publish" ? (
            <>
              <div className="form-grid two">
                <label>
                  发布者
                  <input required value={from} onChange={(event) => setFrom(event.target.value)} placeholder="alice" />
                </label>
                <label>
                  交给谁
                  <input required value={to} onChange={(event) => setTo(event.target.value)} placeholder="bob" />
                </label>
              </div>
              <label>
                当前结果
                <textarea
                  required
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="这一阶段实现了什么，以及现在可以确认什么"
                />
              </label>
              <div className="form-grid three">
                <label>
                  已完成，用分号分隔
                  <textarea value={completed} onChange={(event) => setCompleted(event.target.value)} />
                </label>
                <label>
                  待完成，用分号分隔
                  <textarea value={pending} onChange={(event) => setPending(event.target.value)} />
                </label>
                <label>
                  实现决策，用分号分隔
                  <textarea value={decisions} onChange={(event) => setDecisions(event.target.value)} />
                </label>
              </div>
              <label>
                下一步动作
                <input
                  required
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  placeholder="B 接手后第一件应该做的事"
                />
              </label>
              <label>
                已经运行的检查，用分号分隔
                <input
                  value={checks}
                  onChange={(event) => setChecks(event.target.value)}
                  placeholder="npm test; npm run build"
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={verified}
                  onChange={(event) => setVerified(event.target.checked)}
                />
                <span>
                  <strong>任务要求的检查已经通过</strong>
                  <small>VibeCollab 记录声明，不执行被观察仓库的源码。</small>
                </span>
              </label>
            </>
          ) : (
            <div className="accept-grid">
              <label>
                接收者
                <input required value={actor} onChange={(event) => setActor(event.target.value)} placeholder="bob" />
              </label>
              <label>
                使用的 AI / 工具
                <input
                  required
                  value={executor}
                  onChange={(event) => setExecutor(event.target.value)}
                  placeholder="cursor / claude-code / codex"
                />
              </label>
              <div className="accept-note">
                <CheckCircle2 size={17} />
                <p>系统会先快进同一分支，再核对代码、进度、上下文和验证结果；任何一项不一致都不会获得写入权。</p>
              </div>
            </div>
          )}
          <footer>
            <label className="sync-toggle">
              <input type="checkbox" checked={syncGit} onChange={(event) => setSyncGit(event.target.checked)} />
              同步 GitHub 任务分支
            </label>
            <button
              className="primary-action"
              disabled={
                actionState === "submitting" ||
                (mode === "publish" && !taskCanPublish) ||
                (mode === "accept" && handoff?.state !== "published")
              }
              type="submit"
            >
              {mode === "publish" ? <CloudUpload size={15} /> : <CloudDownload size={15} />}
              {actionState === "submitting"
                ? "正在校验…"
                : mode === "publish"
                  ? "发布并释放写入权"
                  : "接收并成为写入者"}
            </button>
          </footer>
          {mode === "publish" && !taskCanPublish && (
            <p className="action-message">当前 Task 不是开发中状态，不能发布新的接力快照。</p>
          )}
          {message && (
            <p className={`action-message ${actionState}`} role="status">
              {message}
            </p>
          )}
        </form>
      </section>

      <details className="secondary-monitor">
        <summary>
          <Code2 size={14} />
          查看次要监控：代码修改、任务列表与工作量
        </summary>
        <div className="secondary-grid">
          <section>
            <strong>当前工作区</strong>
            <p>{overview.git.changedFiles.length} 个未提交项</p>
            <ul>
              {overview.git.changedFiles.slice(0, 6).map((file) => (
                <li key={file.path}>
                  <code>
                    {file.indexStatus}
                    {file.worktreeStatus}
                  </code>
                  {file.path}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <strong>任务概况</strong>
            <p>
              {overview.project.taskTotals.active} 个活动 / {overview.project.taskTotals.total} 个总任务
            </p>
            <ul>
              {overview.tasks.slice(0, 6).map((task) => (
                <li key={task.id}>
                  <code>{task.id}</code>
                  {taskLabels[task.state]}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <strong>执行覆盖</strong>
            <p>{overview.workload.totals.sessions} 个会话，不作为个人绩效</p>
            <ul>
              {overview.workload.byActor.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <code>{item.id}</code>
                  {item.sessions} sessions
                </li>
              ))}
            </ul>
          </section>
        </div>
      </details>
    </div>
  );
}
