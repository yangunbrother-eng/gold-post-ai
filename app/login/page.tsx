"use client";
import { FormEvent, useEffect, useState } from "react";
import { safeNextPath } from "@/lib/auth";

const SAVED_NAME_KEY = "gold_saved_login_name";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveName, setSaveName] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_NAME_KEY);
      if (saved) setName(saved);
    } catch { /* Login remains available when browser storage is blocked. */ }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !password) { setError("아이디와 비밀번호를 모두 입력해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message || "로그인하지 못했어요."); return; }
      try {
        if (saveName) localStorage.setItem(SAVED_NAME_KEY, name.trim());
        else localStorage.removeItem(SAVED_NAME_KEY);
      } catch { /* Saving the name is optional. */ }
      const requested = new URLSearchParams(window.location.search).get("next");
      window.location.assign(safeNextPath(requested));
    } catch { setError("로그인 연결에 실패했어요. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };

  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-mark" aria-hidden="true">🥕</div>
      <p className="eyebrow">당근 Post AI</p>
      <h1 id="login-title">로그인</h1>
      <p className="login-help">아이디와 비밀번호를 입력해 주세요.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="login-name">아이디</label>
        <input id="login-name" autoComplete="username" value={name} onChange={event => setName(event.target.value)} autoFocus />
        <label htmlFor="login-password">비밀번호</label>
        <input id="login-password" type="password" inputMode="numeric" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
        <label className="login-check"><input type="checkbox" checked={saveName} onChange={event => setSaveName(event.target.checked)} />아이디 저장</label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
      </form>
    </section>
  </main>;
}
