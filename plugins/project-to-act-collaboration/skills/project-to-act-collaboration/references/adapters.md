# 执行工具与 GitHub 适配

## Repository setup

Run `pta init --github` and commit the generated runtime and workflow. The workflow calls:

```text
node .project-to-act/bin/pta.mjs validate --project-root . --ci
```

Require this check on the default branch together with repository-specific lint, tests and builds. Continue to use protected branches, CODEOWNERS, non-author approval and squash merge.

## Task mirroring

The task directory is canonical. A GitHub Issue is a collaboration projection:

- include the stable task ID;
- link to `.project-to-act/tasks/<ID>/TASK.json`;
- use comments for discussion, not an independent rewritten specification;
- write approved changes back to the task directory before implementation continues.

PRs must include task ID, context hash, latest status revision, evidence, risks and deviations.

## 通用入口

任何执行端都必须能够只靠仓库恢复工作：

1. 读取 `AGENTS.md`；
2. 读取 `.project-to-act/skill/SKILL.md`；
3. 调用 `.project-to-act/bin/pta.mjs`；
4. 使用稳定的 `actorId` 和 `executor` 记录会话。

不支持 Skill 自动发现的工具，也可以按上述顺序显式读取。不得以“工具不支持插件”为理由绕过任务、上下文、意图或会话协议。

## 薄适配器

| 执行端         | 薄适配方式                                      | `executor` 建议值  |
| -------------- | ----------------------------------------------- | ------------------ |
| 人工终端/IDE   | README 或开发脚本引用通用 Skill                 | `human`            |
| Codex          | 可选插件；插件内容由权威 Skill 同步生成         | `codex`            |
| Cursor         | `.cursor/rules` 只引用 `AGENTS.md` 与通用 Skill | `cursor`           |
| Claude Code    | `CLAUDE.md` 只导入 `AGENTS.md` 并指向通用 Skill | `claude-code`      |
| GitHub Copilot | `copilot-instructions.md` 指向相同文件          | `copilot`          |
| 其他 Agent     | 启动提示显式要求读取两份入口文件                | 稳定的小写工具标识 |

适配器不得复制业务规范或另建状态库。Codex 插件副本必须通过 `adapters:check` 与权威 Skill 保持逐字一致。

不要向任何适配器授予绕过保护、自动合并、生产部署、读取生产密钥或上传完整私有源码的权限。
