import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo-angelim.png"
      alt="Missão Angelim"
      width={150}
      height={38}
      priority
      className={className}
    />
  );
}

export const ANGELIM_URL = "https://www.angelim.org";

/** Logo da Missão Angelim, que leva ao site da igreja (nova aba, para não perder o formulário). */
export function LogoLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={ANGELIM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Site da Missão Angelim (abre em nova aba)"
      title="angelim.org"
      className="shrink-0 transition hover:opacity-75"
    >
      <Logo className={className} />
    </a>
  );
}

export function SiteHeader({
  children,
  className = "bg-ink text-white",
  darkLogo = false,
}: {
  children?: React.ReactNode;
  className?: string;
  darkLogo?: boolean; // logo em preto, para fundos claros
}) {
  return (
    <header className={`relative ${className}`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <LogoLink className={`h-8 w-auto ${darkLogo ? "brightness-0" : ""}`} />
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink text-white/70 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-xs sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1 select-text">
          <div className="mb-3">
            <LogoLink className="h-6 w-auto opacity-90" />
          </div>
          <p>Avenida dos Expedicionários, 1001 · Teresina - PI · CEP 64046-700</p>
          <p>contato@angelim.org · (86) 99517-4246</p>
        </div>
        <p className="select-text">IGREJA BATISTA ANGELIM TERESINA · CNPJ 30.740.780/0001-77</p>
      </div>
    </footer>
  );
}

// Estrela de quatro pontas, como os brilhos da arte do Natal Solidário.
export function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={`pointer-events-none ${className}`} fill="currentColor">
      <path d="M20 0 C21.5 13 27 18.5 40 20 C27 21.5 21.5 27 20 40 C18.5 27 13 21.5 0 20 C13 18.5 18.5 13 20 0 Z" />
    </svg>
  );
}

/** Topo do painel e do login, no estilo do Natal Solidário. */
export function AdminTopbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b-2 border-ink bg-cream text-ink">
      <Sparkle className="absolute left-[46%] top-2 hidden h-4 w-4 text-gold md:block" />
      <Sparkle className="absolute bottom-2 left-[58%] hidden h-3 w-3 text-natal md:block" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <LogoLink className="h-7 w-auto brightness-0" />
          <span aria-hidden className="hidden h-9 w-px bg-ink/20 sm:block" />
          <Link href="/admin" prefetch={false} aria-label="Painel" className="flex min-w-0 items-center gap-4">
            <span className="relative hidden sm:block">
              <span className="font-script text-3xl leading-none text-natal drop-shadow-[1px_2px_0_rgb(154_27_49/0.3)]">
                Ceia de Natal
              </span>
              <span className="absolute -right-8 -top-2 rotate-12 rounded-sm bg-gold px-1.5 text-[10px] font-extrabold text-ink shadow-[1px_1px_0_var(--color-ink)]">
                2026
              </span>
            </span>
            <span className="ml-6 hidden -rotate-2 rounded-md border-2 border-ink bg-natal px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-[2px_2px_0_var(--color-ink)] md:inline-block">
              Painel da equipe
            </span>
          </Link>
        </div>
        {children}
      </div>
    </header>
  );
}
