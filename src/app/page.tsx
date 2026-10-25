import { DonationForm } from "@/components/donation-form";
import type { FormData } from "@/components/info-panel";
import { SiteFooter, SiteHeader, Sparkle } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, Settings } from "@/lib/types";
import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Hero no estilo da página do Natal Solidário: creme, letreiro vermelho e estrelas douradas. */}
      <div className="relative overflow-hidden bg-cream text-ink print:hidden">
        {/* No celular ficam só as estrelas que não encostam no texto. */}
        <Sparkle className="absolute left-[4%] top-32 h-6 w-6 text-gold sm:left-[8%] sm:top-28 sm:h-12 sm:w-12" />
        <Sparkle className="absolute right-[10%] top-20 hidden h-9 w-9 text-natal sm:block" />
        <Sparkle className="absolute bottom-6 right-[8%] h-7 w-7 text-gold sm:bottom-24 sm:right-[16%] sm:h-14 sm:w-14" />
        <Sparkle className="absolute bottom-16 left-[14%] hidden h-6 w-6 text-natal/70 sm:block" />

        <SiteHeader className="bg-transparent text-ink" darkLogo>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-bold tracking-[0.2em] text-natal md:block">CEIA DE NATAL 2026</span>
            {/* Leva ao painel; quem não está logado cai no login. */}
            <Link
              href="/admin"
              prefetch={false}
              className="rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-px hover:bg-ink hover:text-white"
            >
              Área da equipe
            </Link>
          </div>
        </SiteHeader>

        <section className="relative mx-auto max-w-3xl px-4 pb-24 pt-4 text-center sm:pt-8">
          <p className="text-[11px] font-bold tracking-[0.3em] text-ink/70 sm:text-xs">
            NATAL SOLIDÁRIO · MISSÃO ANGELIM
          </p>

          <h1 className="relative mx-auto mt-4 inline-flex flex-col items-center">
            <span className="font-script text-7xl leading-[0.9] text-natal drop-shadow-[2px_3px_0_rgb(154_27_49/0.35)] sm:text-[8.5rem]">
              Ceia de Natal
            </span>
            <span className="relative -mt-1 inline-block -rotate-2 rounded-md border-2 border-ink bg-natal px-5 py-1.5 text-2xl font-extrabold tracking-[0.12em] text-white shadow-[4px_4px_0_var(--color-ink)] sm:-mt-2 sm:px-8 sm:text-4xl">
              • DOAÇÕES •
            </span>
            <span className="absolute -right-3 top-2 rotate-12 rounded-sm bg-gold px-2 py-0.5 text-xs font-extrabold text-ink shadow-[2px_2px_0_var(--color-ink)] sm:-right-8 sm:top-6 sm:text-sm">
              2026
            </span>
          </h1>

          <p className="mt-6 font-hand text-2xl text-ink sm:text-3xl">• Lagoa do Piauí •</p>

          <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-relaxed text-ink/80 sm:text-base">
            Vamos fazer uma linda ceia de Natal para as famílias de Lagoa do Piauí! Você pode fazer parte
            disso: escolha quantos itens desejar e vamos juntos celebrar!
          </p>
        </section>
      </div>

      {/* Faixa vinho atrás do topo do formulário, como as seções coloridas do Natal Solidário. */}
      <div className="relative flex-1 bg-cream print:bg-white">
        <div aria-hidden className="absolute inset-x-0 top-0 h-64 bg-natal-deep print:hidden" />
        <main className="relative z-10 mx-auto -mt-12 w-full max-w-3xl px-4 pb-16 print:mt-0">
          {/* Não espera o banco: a casca aparece na hora e só os valores carregam. */}
          <DonationForm data={loadFormData()} />
        </main>
      </div>

      <SiteFooter />
    </>
  );
}

// Saldo e configurações são lidos a cada visita (nunca em cache).
async function loadFormData(): Promise<FormData> {
  const supabase = await createClient();
  const [{ data: catalog }, { data: settings }] = await Promise.all([
    supabase.rpc("get_catalog"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  return catalog && settings ? { catalog: catalog as CatalogItem[], settings: settings as Settings } : null;
}
