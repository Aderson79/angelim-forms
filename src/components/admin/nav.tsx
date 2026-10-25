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
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-ink-soft">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
                active ? "border-[#7fc097] text-white" : "border-transparent text-white/60 hover:text-white"
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
      className="rounded-full border border-white/40 px-3 py-1 font-semibold text-white hover:bg-white hover:text-ink"
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
