# 项目版本

> 只在版本号、发布状态、升级路径或兼容性发生变化时读取和更新。

## 当前版本

- 版本号：`0.5.0`
- 发布状态：本地验收通过，尚未推送；公共 GitHub main 仍为 v0.3.0
- 兼容性说明：保持纯文件/零运行时依赖；默认 setup 不采集原文，只有显式 `--private` 才安装策略和 Codex Hooks；旧底层 `--private-sessions` 仍可使用
- 最后更新：2026-08-10

## 下一版本计划

- 目标版本：`0.5.1` 或 Repo Task Sync Protocol v1
- 计划内容：根据真实 Private GitHub 团队试运行反馈完善 Hook 信任、受控升级和稳定 Token 数据源覆盖
- 发布条件：5–10 个真实 PR 完成交接且没有范围外改动、上下文丢失或会话隐私事故

## 版本历史

按时间倒序追加：版本号、日期、状态、主要变更、原因、兼容性、证据 ID 和 Gate 结果。

- `0.5.0`，2026-08-10，本地验收通过、待发布；新增一条命令 Private setup、doctor/report、自动 Git 身份、npm/GitHub bin 分发和 transcript 数值型 Token 降级解析；无服务端、无环境变量、无手动 Session start/stop；证据 E-008；Gate G-007 通过。
- `0.4.0`，2026-08-10，本地验收通过、待发布；新增默认关闭的私有 Session 账本、Codex Hook 薄适配、独立 Markdown、用户原文/AI 总结/墙钟/Git/Token 覆盖统计和公开仓库失败关闭；证据 E-007；Gate G-006 通过。
- `0.3.0`，2026-08-05，公共发布；纯文件模板、通用 Skill、零依赖安装/校验、GitHub PR required check 和双 clone merge 接力；公共仓库与首次 Actions 验证通过；证据 E-004、E-005；Gate G-004、G-005 通过。
- `0.2.0`，2026-08-03，本地验收通过；同一 Task 发布/接收、受限 Git 同步、四项一致性门禁、唯一写入者和聚焦接力台；证据 E-003；Gate G-003 通过。
- `0.1.0`，2026-08-02，本地交接就绪；独立控制面、allowlist、多仓库读取、工具无关 Skill、薄安装、安全门禁、源码 ZIP、Git Bundle 与恢复演练；证据 E-001、E-002；Gate G-001、G-002 通过。
