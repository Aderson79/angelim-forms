import { AdminNav, SignOutButton } from "@/components/admin/nav";
import { SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <p className="p-8 text-center text-sm text-muted">Carregando…</p>
        </>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const email = String(claims.claims.email ?? "");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <>
      <SiteHeader>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-white/60 sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </SiteHeader>
      {isAdmin ? (
        <>
          <AdminNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        </>
      ) : (
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="display text-4xl">Sem acesso</h1>
          <p className="mt-2 text-sm text-muted">
            A conta <b>{email}</b> não está autorizada a ver o painel. Peça a um administrador para incluir
            seu e-mail.
          </p>
        </main>
      )}
    </>
  );
}
