"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  FileWarning,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { CollaborationOverview } from "@/lib/collaboration-contracts";
import type { RegisteredProject } from "@/lib/project-registry";

const taskLabels: Record<string, string> = {
  draft: "草稿",
  ready: "就绪",
  in_progress: "进行中",
  blocked: "阻塞",
  review: "评审",
  done: "完成",
  cancelled: "取消",
};

const contextLabels = { fresh: "新鲜", stale: "漂移", missing: "缺失", unavailable: "不可用" };

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function ProjectDashboard({
  project,
  overview,
}: {
  project: RegisteredProject;
  overview: CollaborationOverview;
}) {
  const [filter, setFilter] = useState("all");
  const tasks = useMemo(
    () => overview.tasks.filter((task) => filter === "all" || task.state === filter),
    [filter, overview.tasks],
  );
  const codeDelta = (overview.git.staged ?? 0) + (overview.git.unstaged ?? 0) + (overview.git.untracked ?? 0);
  const activeStale = overview.tasks.filter(
    (task) => ["ready", "in_progress", "blocked", "review"].includes(task.state) && task.context.state !== "fresh",
  ).length;
  const risks = overview.conflicts.length + overview.warnings.filter((warning) => warning.severity !== "info").length;

  return (
    <div className="shell dashboard">
      <div className="breadcrumb">
        <Link href="/">
          <ArrowLeft size={13} />
          全部项目
        </Link>
        <span>/</span>
        <strong>{project.name}</strong>
      </div>
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">PROJECT · {project.id.toUpperCase()}</p>
          <h1>{project.name}</h1>
          <p>{project.root}</p>
        </div>
        <button type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={14} />
          刷新仓库快照
        </button>
      </header>

      <section className="metric-row" aria-label="项目协作快照">
        <div>
          <small>FEATURE DELIVERY</small>
          <strong>{overview.project.featureTotals.completionPercent}%</strong>
          <p>
            {overview.project.featureTotals.completed}/{overview.project.featureTotals.total} 功能完成
          </p>
        </div>
        <div>
          <small>ACTIVE TASKS</small>
          <strong>{overview.project.taskTotals.active}</strong>
          <p>{overview.project.taskTotals.total} 个任务契约</p>
        </div>
        <div>
          <small>RUNNING SESSIONS</small>
          <strong>{overview.workload.totals.active}</strong>
          <p>{overview.workload.totals.sessions} 个会话事实</p>
        </div>
        <div className={codeDelta ? "amber" : ""}>
          <small>CODE DELTA</small>
          <strong>{codeDelta}</strong>
          <p>当前 worktree 项</p>
        </div>
        <div className={risks ? "red" : ""}>
          <small>GUARDRAILS</small>
          <strong>{risks}</strong>
          <p>{risks ? "需要处理" : "边界清晰"}</p>
        </div>
      </section>

      <section className="evidence-chain">
        <div>
          <ShieldCheck size={16} />
          <span>
            <strong>共享证据链</strong>
            <small>所有执行端读取同一事实</small>
          </span>
        </div>
        <div>
          <span>01</span>
          <strong>功能</strong>
          <small>{overview.features.length} FEATURES</small>
        </div>
        <i />
        <div>
          <span>02</span>
          <strong>任务</strong>
          <small>{overview.tasks.length} CONTRACTS</small>
        </div>
        <i />
        <div>
          <span>03</span>
          <strong>会话</strong>
          <small>{overview.workload.totals.sessions} SESSIONS</small>
        </div>
        <i />
        <div>
          <span>04</span>
          <strong>Git</strong>
          <small>{overview.git.recentCommits.length} COMMITS</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel feature-panel">
          <header>
            <div>
              <p className="eyebrow">01 / PRODUCT TRUTH</p>
              <h2>功能交付</h2>
            </div>
            <span>{overview.project.featureTotals.completionPercent}% ACCEPTED</span>
          </header>
          <div className="progress">
            <i style={{ width: `${overview.project.featureTotals.completionPercent}%` }} />
          </div>
          <div className="feature-list">
            {overview.features.map((feature) => (
              <article key={feature.id}>
                <span>{feature.id}</span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.completion}</p>
                </div>
                <em className={feature.state === "已完成" ? "done" : feature.state === "已阻塞" ? "blocked" : "active"}>
                  {feature.state}
                </em>
                <code>{feature.evidenceId ?? "NO EVIDENCE"}</code>
              </article>
            ))}
          </div>
        </section>

        <aside className="risk-column">
          <section className="panel risk-panel">
            <header>
              <div>
                <p className="eyebrow">02 / SYNC GUARD</p>
                <h2>协作风险</h2>
              </div>
              <AlertTriangle size={16} />
            </header>
            {!risks && !activeStale && (
              <div className="empty-state">
                <CheckCircle2 size={22} />
                <strong>活动边界清晰</strong>
                <p>没有意图冲突或陈旧活动上下文。</p>
              </div>
            )}
            {activeStale > 0 && (
              <div className="risk-item critical">
                <FileWarning size={15} />
                <div>
                  <strong>活动上下文漂移</strong>
                  <p>{activeStale} 个任务必须重建上下文。</p>
                </div>
              </div>
            )}
            {overview.conflicts.map((conflict) => (
              <div className="risk-item critical" key={conflict.tasks.join("-")}>
                <Route size={15} />
                <div>
                  <strong>{conflict.tasks.join(" ↔ ")}</strong>
                  <p>{conflict.reasons.slice(0, 2).join("；")}</p>
                </div>
              </div>
            ))}
            {overview.warnings.map((warning, index) => (
              <div className={`risk-item ${warning.severity}`} key={`${warning.code}-${index}`}>
                <AlertTriangle size={15} />
                <div>
                  <strong>{warning.code}</strong>
                  <p>{warning.message}</p>
                </div>
              </div>
            ))}
          </section>
          <section className="panel baseline-panel">
            <header>
              <div>
                <p className="eyebrow">LIVE BASELINE</p>
                <h2>Git 基线</h2>
              </div>
              <GitBranch size={16} />
            </header>
            <dl>
              <div>
                <dt>BRANCH</dt>
                <dd>{overview.git.branch ?? "UNAVAILABLE"}</dd>
              </div>
              <div>
                <dt>HEAD</dt>
                <dd>{overview.git.headSha?.slice(0, 10) ?? "UNAVAILABLE"}</dd>
              </div>
              <div>
                <dt>WORKTREES</dt>
                <dd>{overview.git.worktrees.length}</dd>
              </div>
              <div>
                <dt>CONTEXT DRIFT</dt>
                <dd>{overview.tasks.filter((task) => task.context.state === "stale").length}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="panel task-panel">
        <header>
          <div>
            <p className="eyebrow">03 / TASK CONTROL</p>
            <h2>任务、负责人和 AI 上下文</h2>
          </div>
          <div className="filters" role="group" aria-label="任务状态筛选">
            {["all", "in_progress", "review", "blocked", "done"].map((state) => (
              <button
                key={state}
                type="button"
                className={filter === state ? "selected" : ""}
                onClick={() => setFilter(state)}
              >
                {state === "all" ? "全部" : taskLabels[state]}
              </button>
            ))}
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>负责人</th>
                <th>状态</th>
                <th>上下文</th>
                <th>Intent</th>
                <th>证据</th>
                <th>分支</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.id}</strong>
                    <small>{task.title}</small>
                  </td>
                  <td>{task.owner ?? "未分配"}</td>
                  <td>
                    <span className={`state ${task.state}`}>{taskLabels[task.state]}</span>
                  </td>
                  <td>
                    <span className={`context ${task.context.state}`}>
                      <i />
                      {contextLabels[task.context.state]}
                    </span>
                    {task.context.changedPaths.length > 0 && <small>{task.context.changedPaths.length} changed</small>}
                  </td>
                  <td>
                    <strong>{task.intent.pathCount} paths</strong>
                    <small>
                      {task.intent.symbolCount} symbols · {task.intent.writesContracts.length} contracts
                    </small>
                  </td>
                  <td>
                    <strong>{task.checkpoints + task.evidence}</strong>
                    <small>
                      {task.checkpoints} checkpoint · {task.evidence} evidence
                    </small>
                  </td>
                  <td>
                    <code>{task.branch ?? "—"}</code>
                    <small>revision {task.revision}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bottom-grid">
        <section className="panel code-panel">
          <header>
            <div>
              <p className="eyebrow">04 / CODE PROGRESS</p>
              <h2>当前修改与近期提交</h2>
            </div>
            <Code2 size={16} />
          </header>
          <div className="delta-row">
            <div>
              <i className="green" />
              <strong>{overview.git.staged ?? "—"}</strong>
              <small>STAGED</small>
            </div>
            <div>
              <i className="amber" />
              <strong>{overview.git.unstaged ?? "—"}</strong>
              <small>UNSTAGED</small>
            </div>
            <div>
              <i className="red" />
              <strong>{overview.git.untracked ?? "—"}</strong>
              <small>UNTRACKED</small>
            </div>
          </div>
          <div className="changed-files">
            {overview.git.changedFiles.slice(0, 12).map((file) => (
              <div key={`${file.path}-${file.indexStatus}-${file.worktreeStatus}`}>
                <code>
                  {file.indexStatus}
                  {file.worktreeStatus}
                </code>
                <span>{file.path}</span>
              </div>
            ))}
          </div>
          <div className="commits">
            <h3>RECENT COMMITS</h3>
            {overview.git.recentCommits.map((commit) => (
              <article key={commit.sha}>
                <span>
                  <GitCommitHorizontal size={13} />
                </span>
                <div>
                  <strong>{commit.subject}</strong>
                  <small>
                    {commit.author} · {new Date(commit.authoredAt).toLocaleString("zh-CN", { hour12: false })}
                  </small>
                </div>
                <code>{commit.sha}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="panel workload-panel">
          <header>
            <div>
              <p className="eyebrow">05 / EXECUTION COVERAGE</p>
              <h2>人员与 AI 执行端</h2>
            </div>
            <Users size={16} />
          </header>
          <p className="disclaimer">会话时长、Git 文件数和 token 只表示覆盖范围，不用于个人绩效。</p>
          <div className="workload-summary">
            <div>
              <Activity size={15} />
              <span>
                <small>SESSIONS</small>
                <strong>{overview.workload.totals.sessions}</strong>
              </span>
            </div>
            <div>
              <Clock3 size={15} />
              <span>
                <small>ELAPSED</small>
                <strong>{duration(overview.workload.totals.elapsedSeconds)}</strong>
              </span>
            </div>
            <div>
              <Bot size={15} />
              <span>
                <small>EXECUTORS</small>
                <strong>{overview.workload.byExecutor.length}</strong>
              </span>
            </div>
          </div>
          <div className="actors">
            {overview.workload.byActor.map((actor) => (
              <article key={actor.id}>
                <span>{actor.id.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{actor.id}</strong>
                  <small>{actor.tasks.join(" · ")}</small>
                  <i>
                    <em
                      style={{
                        width: `${Math.round((actor.sessions / Math.max(overview.workload.totals.sessions, 1)) * 100)}%`,
                      }}
                    />
                  </i>
                </div>
                <div>
                  <strong>{actor.sessions}</strong>
                  <small>{duration(actor.elapsedSeconds)}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="executors">
            <h3>TOOLS / AGENTS</h3>
            {overview.workload.byExecutor.map((executor) => (
              <span key={executor.id}>
                <Bot size={12} />
                {executor.id}
                <small>{executor.sessions}</small>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
