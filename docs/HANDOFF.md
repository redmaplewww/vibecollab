# VibeCollab v0.1.0 交接说明

## 1. 交接结论

VibeCollab 已作为独立项目完成本地 v0.1.0 基线。平台不再嵌入 AgentLoop；AgentLoop 仅保留 vendored `.project-to-act` 接入事实。当前控制台可读取真实 AgentLoop 仓库的功能、任务、会话、上下文和 Git 状态。

交接包由已提交 Git HEAD 生成。精确提交、分支、文件大小和 SHA-256 以包内 `PACKAGE-MANIFEST.json` 为准，不依赖本说明中的静态文本。

## 2. 交付内容

| 工件                           | 用途                                            |
| ------------------------------ | ----------------------------------------------- |
| `VibeCollab-v0.1.0-source.zip` | 不需要 Git 历史时直接解压使用的源码快照         |
| `VibeCollab-v0.1.0.bundle`     | 包含完整提交与分支的 Git 仓库备份，可直接 clone |
| `README-HANDOFF.md`            | 本文件的独立副本                                |
| `PACKAGE-MANIFEST.json`        | 包版本、提交、分支、生成时间、文件大小和哈希    |
| `SHA256SUMS.txt`               | 交付工件完整性校验                              |

源码 ZIP 包含应用源码、Skill、可选插件、测试、Project-to-Act 事实、README、架构文档和打包脚本。

源码 ZIP 不包含 `.git`、`node_modules`、`.next`、coverage、runtime heartbeat、本机项目注册表、`.env.local`、日志或交接产物目录。

## 3. 接手人的最短恢复路径

### 方式 A：从 Git Bundle 恢复（推荐）

```powershell
git bundle verify .\VibeCollab-v0.1.0.bundle
git clone .\VibeCollab-v0.1.0.bundle VibeCollab
Set-Location VibeCollab
npm ci
npm run verify
```

### 方式 B：从源码 ZIP 恢复

```powershell
Expand-Archive .\VibeCollab-v0.1.0-source.zip -DestinationPath .\restored
Set-Location .\restored\VibeCollab-v0.1.0
npm ci
npm run verify
```

随后创建本机配置：

```powershell
Copy-Item vibecollab.config.json vibecollab.config.local.json
npm run dev
```

访问 `http://127.0.0.1:3210`。

## 4. 当前实现状态

- 独立 Next.js 控制台与产品视觉：完成。
- 多本地仓库 allowlist：完成。
- Project-to-Act 功能、任务、Intent、Context、会话与证据读取：完成。
- Git status、worktree、当前修改和近期提交读取：完成。
- 本地开发访问和生产管理员令牌：完成。
- 未注册项目 404、不可用项目 503：完成。
- 工具无关 Skill 和零依赖 CLI：完成。
- Codex 可选插件与权威 Skill 漂移检查：完成。
- 空仓库薄安装：完成并验证没有复制平台源码。
- 独立 GitHub remote、Release、GitHub App：未配置。
- 多租户、组织 RBAC、跨机器实时 heartbeat：未实现。

## 5. 已验证基线

v0.1.0 已通过：

- Prettier、ESLint 和 TypeScript。
- 4 项访问与项目聚合单元测试。
- Next.js 生产构建。
- Skill 格式校验和插件适配器一致性检查。
- Project-to-Act `validate --ci`。
- npm 依赖审计，0 个已知漏洞。
- 空白 Git 仓库安装夹具。
- 真实 AgentLoop 仓库页面与 API 浏览器冒烟测试。

交接包任务会额外验证 Git Bundle、ZIP 内容、空目录恢复、`npm ci` 和恢复仓库的完整 `npm run verify`。最终结果记录在 `.project-to-act/tasks/VC-002/evidence/`。

## 6. 运行配置

### 必需软件

- Node.js 20 或更高版本。
- npm（使用仓库 `package-lock.json`）。
- Git。

### 环境变量

| 变量                     | 开发环境 | 生产环境 | 说明                       |
| ------------------------ | -------- | -------- | -------------------------- |
| `VIBECOLLAB_ADMIN_TOKEN` | 可为空   | 必填     | 登录与只读 API Bearer 令牌 |

### 本机文件

`vibecollab.config.local.json` 与 `.env.local` 均被 Git 忽略。交接后必须由新环境重新创建，不能从旧机器复制真实密钥。

## 7. 日常运维

### 启动前

1. 确认项目注册表路径仍有效。
2. 确认目标仓库包含 `.project-to-act`。
3. 生产环境确认管理员令牌已通过部署系统注入。
4. 运行 `npm run verify`。

### 出现异常时

- 项目 404：检查注册表 ID，URL 不能直接传磁盘路径。
- 项目 503：检查根目录是否存在以及是否完成 Project-to-Act 初始化。
- Context stale：回到目标仓库执行 `context build <ID>`，不要在 UI 中强行忽略。
- Git unavailable：确认目标路径是 Git 仓库且运行账户有只读权限。
- 生产环境跳转登录：确认 `VIBECOLLAB_ADMIN_TOKEN` 已设置且请求使用正确 Cookie 或 Bearer。
- 适配器漂移：在 VibeCollab 执行同步脚本，再运行 `npm run adapters:check`。

### 明确禁止

- 不给控制台增加执行目标仓库源码的能力。
- 不允许网页接受任意磁盘路径。
- 不把 token、成本、代码行或在线时长转换为人员绩效分数。
- 不绕过 Task Contract、required checks 或人工验收自动合并。

## 8. 下一阶段建议

按优先级：

1. 创建独立 GitHub 仓库，设置 CODEOWNERS、保护分支、required checks 和 squash merge。
2. 用 5–10 个真实团队任务试运行并冻结 Task Contract v1。
3. 增加 GitHub 远程 PR、review 和 required checks 的只读投影。
4. 增加组织、成员、项目级 RBAC 和审计日志。
5. 需要跨机器协作时，再增加耐久事件服务和 heartbeat 聚合。
6. 公开分发前由所有者选择开源许可证并增加 `LICENSE`。

## 9. 所有者仍需决策

- 独立 GitHub 仓库地址和组织归属。
- 开源许可证。
- 首个正式部署位置、域名和密钥托管方案。
- v0.2.0 是否优先 GitHub App、RBAC 或跨机器事件聚合。

## 10. 交接验收清单

- [ ] `SHA256SUMS.txt` 校验通过。
- [ ] `git bundle verify` 通过。
- [ ] 可以从 Bundle clone。
- [ ] 可以从 ZIP 解压。
- [ ] `npm ci` 通过。
- [ ] `npm run verify` 通过。
- [ ] 已重新创建本机注册表，没有复用旧机器密钥。
- [ ] 能打开项目列表和一个真实仓库页面。
- [ ] 已阅读 README、架构说明、安全边界和已知限制。
- [ ] 已确认 GitHub、许可证与正式部署的下一位负责人。
