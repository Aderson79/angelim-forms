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
        <Link href="/" aria-label="Início">
          <Logo className={`h-8 w-auto ${darkLogo ? "brightness-0" : ""}`} />
        </Link>
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink text-white/70 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-xs sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Logo className="mb-3 h-6 w-auto opacity-90" />
          <p>Avenida dos Expedicionários, 1001 · Teresina - PI · CEP 64046-700</p>
          <p>contato@angelim.org · (86) 99517-4246</p>
        </div>
        <p>IGREJA BATISTA ANGELIM TERESINA · CNPJ 30.740.780/0001-77</p>
      </div>
    </footer>
  );
}
