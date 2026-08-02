import Link from "next/link";
import { ArrowUpRight, FolderGit2, GitBranch, ShieldCheck } from "lucide-react";
import { requirePageAccess } from "@/lib/access";
import { listProjects } from "@/lib/project-registry";

export const metadata = { title: "项目控制面" };

export default async function HomePage() {
  await requirePageAccess("/");
  const projects = listProjects();
  return (
    <div className="shell home-page">
      <header className="hero">
        <p className="eyebrow">TEAM VIBE CODING · SHARED CONTEXT</p>
        <h1>仓库保存共识，AI 只负责执行。</h1>
        <p>独立观察多个代码库中的功能、任务、人员与 AI 会话、上下文风险和 Git 修改，不侵入任何业务应用。</p>
      </header>
      <section className="principles" aria-label="协作原则">
        <div>
          <span>01</span>
          <strong>任务契约统一思路</strong>
          <small>goal · scope · invariants · acceptance</small>
        </div>
        <div>
          <span>02</span>
          <strong>Intent 阻止并发改乱</strong>
          <small>paths · symbols · contracts · migrations</small>
        </div>
        <div>
          <span>03</span>
          <strong>Git 与 CI 裁决结果</strong>
          <small>worktree · review · checks · evidence</small>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">REGISTERED REPOSITORIES</p>
          <h2>项目控制面</h2>
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
              读取 Project-to-Act 与 Git
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
