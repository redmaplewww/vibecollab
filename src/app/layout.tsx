import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BookOpen, GitBranch, ShieldCheck } from "lucide-react";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "VibeCollab", template: "%s · VibeCollab" },
  description: "Repository-native team Vibe Coding collaboration control plane.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Activity size={16} />
            </span>
            <span>
              <strong>VibeCollab</strong>
              <small>REPOSITORY CONTROL PLANE</small>
            </span>
          </Link>
          <nav aria-label="主导航">
            <Link href="/">
              <GitBranch size={14} />
              项目
            </Link>
            <a href="https://github.com/redmaplewww/project-to-act" target="_blank" rel="noreferrer">
              <BookOpen size={14} />
              协议来源
            </a>
            <span>
              <ShieldCheck size={14} />
              READ ONLY
            </span>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
