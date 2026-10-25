"use client";

import { AdminTopbar } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // O Next guarda a tela ao navegar; quando ela sai de vista (ex.: entrou no painel),
  // limpa a senha e o "Entrando…" para o login voltar limpo depois de "Sair".
  useEffect(
    () => () => {
      setPassword("");
      setPending(false);
      setError(null);
    },
    [],
  );

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
      <AdminTopbar>
        <Link
          href="/"
          className="shrink-0 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-px hover:bg-ink hover:text-white"
        >
          ← Voltar ao formulário
        </Link>
      </AdminTopbar>
      <main className="flex flex-1 items-center justify-center bg-cream px-4 pb-24 pt-8">
        <form onSubmit={onSubmit} className="card-natal w-full max-w-sm space-y-4 p-8">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-natal">ÁREA RESTRITA</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Painel da <span className="font-script font-normal tracking-normal text-natal">equipe</span></h1>
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
          <button type="submit" disabled={pending} className="btn-natal w-full py-3">
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    </>
  );
}
