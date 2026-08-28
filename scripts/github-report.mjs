#!/usr/bin/env node

import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateRepository } from "./check.mjs";

function parseArgs(argv) {
  const options = { root: process.cwd(), base: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.root = resolve(argv[++index]);
    else if (value === "--base") options.base = argv[++index];
    else if (value === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function usableBase(root, requestedBase) {
  if (!requestedBase || /^0+$/.test(requestedBase)) return null;
  return git(root, ["merge-base", "--is-ancestor", requestedBase, "HEAD"]) !== null ? requestedBase : null;
}

function contributionRows(root, base) {
  if (!base) return [];
  const log = git(root, ["log", "--format=%H%x09%aN", `${base}..HEAD`, "--"]);
  if (!log) return [];
  const contributors = new Map();
  for (const line of log.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("\t");
    if (separator < 0) continue;
    const sha = line.slice(0, separator);
    const author = line.slice(separator + 1).trim() || "unknown";
    const entry = contributors.get(author) ?? {
      author,
      commits: 0,
      files: new Set(),
      additions: 0,
      deletions: 0,
    };
    entry.commits += 1;
    const numstat = git(root, ["show", "--numstat", "--format=", "--no-renames", sha, "--"]) ?? "";
    for (const stat of numstat.split(/\r?\n/).filter(Boolean)) {
      const [added, deleted, path] = stat.split("\t");
      if (path) entry.files.add(path);
      if (/^\d+$/.test(added)) entry.additions += Number(added);
      if (/^\d+$/.test(deleted)) entry.deletions += Number(deleted);
    }
    contributors.set(author, entry);
  }
  return [...contributors.values()]
    .map(({ files, ...entry }) => ({ ...entry, files: files.size }))
    .sort((left, right) => right.commits - left.commits || left.author.localeCompare(right.author));
}

export function buildGithubProgressReport({
  root = process.cwd(),
  base = null,
  github = process.env,
} = {}) {
  const absoluteRoot = resolve(root);
  const resolvedBase = usableBase(absoluteRoot, base);
  const validation = validateRepository({ root: absoluteRoot, base: resolvedBase, allTasks: true });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "github-native",
    github: {
      actor: github.GITHUB_ACTOR || "local",
      repository: github.GITHUB_REPOSITORY || "local",
      event: github.GITHUB_EVENT_NAME || "local",
      ref: github.GITHUB_REF_NAME || git(absoluteRoot, ["branch", "--show-current"]) || "detached",
      sha: github.GITHUB_SHA || git(absoluteRoot, ["rev-parse", "HEAD"]),
    },
    comparison: {
      requestedBase: base,
      base: resolvedBase,
      note: resolvedBase
        ? "Only committed Git evidence in base..HEAD is included."
        : "No usable base was supplied; task state is shown without contribution totals.",
    },
    valid: validation.valid,
    tasks: validation.tasks,
    git: validation.git,
    contributors: contributionRows(absoluteRoot, resolvedBase),
    warnings: validation.warnings,
    errors: validation.errors,
    limitations: [
      "GitHub cannot see uncommitted local work or focused work hours.",
      "Line counts are change volume, not individual performance.",
      "Task acceptance and CI evidence describe implemented functionality; AI chat is not a fact source.",
    ],
  };
}

function cell(value) {
  return String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function stateMark(status) {
  if (status === "done") return "✅";
  if (status === "blocked") return "⛔";
  if (status === "handoff") return "🤝";
  if (status === "active") return "🚧";
  return "📝";
}

export function renderGithubProgressMarkdown(report) {
  const taskRows = report.tasks.length
    ? report.tasks.map(
        (task) =>
          `| ${stateMark(task.status)} ${cell(task.id)} | ${cell(task.title)} | ${cell(task.status)} | ${cell(task.owner)} | ${task.acceptance.completed}/${task.acceptance.total}${task.acceptance.percent === null ? "" : ` (${task.acceptance.percent}%)`} | ${task.verification.completed}/${task.verification.total} |`,
      )
    : ["| — | No task files | — | — | — | — |"]; 
  const contributionRowsMarkdown = report.contributors.length
    ? report.contributors.map(
        (entry) => `| ${cell(entry.author)} | ${entry.commits} | ${entry.files} | +${entry.additions} / -${entry.deletions} |`,
      )
    : ["| — | 0 | 0 | +0 / -0 |"]; 
  const diagnostics = [
    ...report.warnings.map((item) => `- ⚠️ ${item}`),
    ...report.errors.map((item) => `- ❌ ${item}`),
  ];
  return [
    "# VibeCollab · GitHub 原生进度",
    "",
    `- 结果：${report.valid ? "✅ 协作规则通过" : "❌ 协作规则未通过"}`,
    `- 仓库：\`${cell(report.github.repository)}\``,
    `- 触发者：\`${cell(report.github.actor)}\`（身份与权限由 GitHub 管理）`,
    `- 事件：\`${cell(report.github.event)}\` · 分支：\`${cell(report.github.ref)}\``,
    `- 比较基线：${report.comparison.base ? `\`${cell(report.comparison.base)}\`` : "未提供"}`,
    "",
    "## 功能进度",
    "",
    "| Task | 功能结果 | 状态 | 负责人 | 验收 | 验证 |",
    "| --- | --- | --- | --- | ---: | ---: |",
    ...taskRows,
    "",
    "## 已提交代码贡献",
    "",
    "| Git 提交作者 | Commit | 涉及文件 | 代码增删 |",
    "| --- | ---: | ---: | ---: |",
    ...contributionRowsMarkdown,
    "",
    report.git.available
      ? `本次合计：${report.git.commits} commits，${report.git.changedFiles} files，+${report.git.additions}/-${report.git.deletions}。`
      : report.comparison.note,
    "",
    "## 说明",
    "",
    "- 功能是否实装，以 Task 验收项、测试和 CI 为准。",
    "- 这里仅统计 GitHub 可见的已提交记录；无法推断未提交工作或真实专注工时。",
    "- 增删行只用于理解变更规模，不用于个人绩效评分。",
    ...(diagnostics.length ? ["", "## 诊断", "", ...diagnostics] : []),
    "",
  ].join("\n");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = buildGithubProgressReport(options);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderGithubProgressMarkdown(report));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
