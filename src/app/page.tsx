import { DonationForm } from "@/components/donation-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, Settings } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: catalog }, { data: settings }] = await Promise.all([
    supabase.rpc("get_catalog"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <>
      <SiteHeader>
        <span className="hidden text-xs font-semibold tracking-[0.2em] text-white/60 sm:block">
          CEIA DE NATAL 2025
        </span>
      </SiteHeader>

      <section className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-wine/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-8 sm:pt-12">
          <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-brand-soft/80">MISSÃO ANGELIM</p>
          <h1 className="display text-6xl sm:text-8xl">
            Doações para a <span className="text-[#7fc097]">ceia de Natal</span> 2025
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-medium italic text-white/80 sm:text-base">
            VAMOS FAZER UMA LINDA CEIA DE NATAL PARA AS FAMÍLIAS DE LAGOA DO PIAUÍ! VOCÊ PODE FAZER PARTE
            DISSO, ESCOLHA QUANTOS ITENS DESEJAR E VAMOS JUNTOS CELEBRAR!
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-6 w-full max-w-3xl flex-1 px-4 pb-16">
        {catalog && settings ? (
          <DonationForm
            initialCatalog={catalog as CatalogItem[]}
            settings={settings as Settings}
          />
        ) : (
          <div className="card p-8 text-center">
            <p className="font-semibold">Não foi possível carregar o formulário.</p>
            <p className="mt-1 text-sm text-muted">Atualize a página em alguns instantes.</p>
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
