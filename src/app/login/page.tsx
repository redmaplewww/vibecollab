import { LockKeyhole } from "lucide-react";

export const metadata = { title: "管理员登录" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const query = await searchParams;
  const callbackUrl = query.callbackUrl?.startsWith("/") ? query.callbackUrl : "/";
  return (
    <div className="login-shell">
      <form className="login-card" action="/api/session" method="post">
        <span>
          <LockKeyhole size={22} />
        </span>
        <p className="eyebrow">ADMIN ACCESS</p>
        <h1>进入协作控制面</h1>
        <p>使用部署时配置的管理员令牌。令牌只用于建立 HttpOnly 会话，不写入项目仓库。</p>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label htmlFor="token">管理员令牌</label>
        <input id="token" name="token" type="password" autoComplete="current-password" required />
        {query.error && <div role="alert">令牌无效或服务尚未配置。</div>}
        <button type="submit">验证并进入</button>
      </form>
    </div>
  );
}
