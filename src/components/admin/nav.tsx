"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/doacoes", label: "Doações" },
  { href: "/admin/itens", label: "Itens" },
  { href: "/admin/configuracoes", label: "Configurações" },
  { href: "/admin/auditoria", label: "Auditoria" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 border-b-2 border-ink bg-natal-deep">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
                active ? "border-gold text-white" : "border-transparent text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full border-2 border-ink bg-white px-3 py-1 font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-ink hover:text-white"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
