"use client";

import { SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("E-mail ou senha incorretos.");
      setPending(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-ink px-4 pb-24 pt-8">
        <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-muted">ÁREA RESTRITA</p>
            <h1 className="display mt-1 text-4xl">Painel das doações</h1>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm font-medium text-wine">{error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full py-3">
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    </>
  );
}
