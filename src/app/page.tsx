import { DonationForm } from "@/components/donation-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, Settings } from "@/lib/types";
import { Suspense } from "react";

export default function Home() {
  return (
    <>
      <div className="relative overflow-hidden bg-ink text-white print:hidden">
        <Snow />

        <SiteHeader className="bg-transparent">
          <span className="hidden text-xs font-semibold tracking-[0.2em] text-xmas-light sm:block">
            CEIA DE NATAL 2026
          </span>
        </SiteHeader>

        <section className="relative mx-auto max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
          <p className="mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.3em] text-xmas-light">
            <span className="h-px w-8 bg-xmas-light/70" aria-hidden />
            MISSÃO ANGELIM
          </p>
          <h1 className="display text-6xl sm:text-8xl">
            Doações para a <span className="text-xmas-light">ceia de Natal</span> 2026
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-medium italic text-white/90 sm:text-base">
            VAMOS FAZER UMA LINDA CEIA DE NATAL PARA AS FAMÍLIAS DE LAGOA DO PIAUÍ! VOCÊ PODE FAZER PARTE
            DISSO, ESCOLHA QUANTOS ITENS DESEJAR E VAMOS JUNTOS CELEBRAR!
          </p>
        </section>
      </div>

      <main className="relative z-10 mx-auto -mt-8 w-full max-w-3xl flex-1 px-4 pb-16 print:mt-0">
        <Suspense fallback={<FormSkeleton />}>
          <FormLoader />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

// Saldo e configurações são lidos a cada visita (nunca em cache).
async function FormLoader() {
  const supabase = await createClient();
  const [{ data: catalog }, { data: settings }] = await Promise.all([
    supabase.rpc("get_catalog"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  if (!catalog || !settings) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold">Não foi possível carregar o formulário.</p>
        <p className="mt-1 text-sm text-muted">Atualize a página em alguns instantes.</p>
      </div>
    );
  }
  return <DonationForm initialCatalog={catalog as CatalogItem[]} settings={settings as Settings} />;
}

// Neve sutil: duas camadas de pontos deslocadas.
function Snow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "radial-gradient(rgb(255 255 255 / 0.22) 1.5px, transparent 1.6px), radial-gradient(rgb(255 255 255 / 0.12) 1px, transparent 1.2px)",
        backgroundSize: "46px 46px, 23px 23px",
        backgroundPosition: "0 0, 11px 17px",
      }}
    />
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      {[220, 260, 420].map((h) => (
        <div key={h} className="card animate-pulse bg-white/70" style={{ height: h }} />
      ))}
    </div>
  );
}
