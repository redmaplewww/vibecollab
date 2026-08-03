import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderGit2, GitBranch, ShieldCheck } from "lucide-react";
import { requirePageAccess } from "@/lib/access";
import { listProjects } from "@/lib/project-registry";

export const metadata = { title: "项目控制面" };

export default async function HomePage() {
  await requirePageAccess("/");
  const projects = listProjects();
  return (
    <div className="shell home-page">
      <header className="hero">
        <p className="eyebrow">ONE TASK · TWO DEVELOPERS · ONE CONTEXT</p>
        <h1>一个人停下，另一个人从同一处继续。</h1>
        <p>
          把同一个 Task 的代码版本、功能进度、实现决策和 AI
          上下文一起交接。无需共享聊天记录，也不会让两个人同时改乱代码。
        </p>
      </header>
      <section className="principles" aria-label="协作原则">
        <div>
          <span>01</span>
          <strong>A 发布完整进度</strong>
          <small>完成项 · 待办 · 决策 · 下一步</small>
        </div>
        <div>
          <span>02</span>
          <strong>四项一致才能接管</strong>
          <small>code · revision · context · verification</small>
        </div>
        <div>
          <span>03</span>
          <strong>B 接管同一 Task</strong>
          <small>one branch · one writer · any AI</small>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">REGISTERED REPOSITORIES</p>
          <h2>选择要接力的项目</h2>
        </div>
        <span>{projects.length} PROJECTS</span>
      </div>
      <section className="project-grid">
        {projects.map((project) => (
          <Link href={`/projects/${project.id}`} className="project-card" key={project.id}>
            <span className="project-icon">
              <FolderGit2 size={19} />
            </span>
            <div>
              <small>{project.id.toUpperCase()}</small>
              <h3>{project.name}</h3>
              <p>{project.root}</p>
            </div>
            <ArrowUpRight size={17} />
            <footer>
              <GitBranch size={12} />
              打开当前 Task 接力台
              <ArrowRight size={11} />
            </footer>
          </Link>
        ))}
      </section>
      <section className="install-callout">
        <ShieldCheck size={22} />
        <div>
          <strong>接入新仓库，不复制平台代码。</strong>
          <p>只安装可版本化 Skill、零依赖 CLI、任务模板和 CI 门禁。</p>
        </div>
        <code>pta.mjs init --project-root &lt;repo&gt; --github</code>
      </section>
    </div>
  );
}
