"use client";

import { LoadState, PageTitle } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { downloadCsv } from "@/lib/csv";
import { brl, groupByCategory } from "@/lib/format";
import type { CatalogItem } from "@/lib/types";

export default function DashboardPage() {
  const { catalog, donations, loaded, error, reload } = useAdminData();
  const active = donations.filter((d) => d.status === "ativa");

  const limitTotal = catalog.reduce((t, c) => t + c.limit_qty, 0);
  const committed = catalog.reduce((t, c) => t + c.committed, 0);
  const received = catalog.reduce((t, c) => t + c.received, 0);
  const pixExpected = catalog.reduce((t, c) => t + (c.pix_price ? c.committed * Number(c.pix_price) : 0), 0);
  const pixConfirmed = catalog.reduce((t, c) => t + (c.pix_price ? c.received * Number(c.pix_price) : 0), 0);
  const donors = new Set(active.map((d) => d.phone.replace(/\D/g, ""))).size;
  const soldOut = catalog.filter((c) => c.active && c.remaining === 0).length;

  function exportConsolidated() {
    downloadCsv("consolidado-por-item.csv", [
      ["Categoria", "Item", "Limite", "Prometido", "Recebido", "Restante", "Valor PIX unit.", "PIX esperado", "PIX confirmado", "Ativo"],
      ...catalog.map((c) => [
        c.category,
        c.name,
        c.limit_qty,
        c.committed,
        c.received,
        c.remaining,
        c.pix_price ? Number(c.pix_price).toFixed(2).replace(".", ",") : "",
        c.pix_price ? (c.committed * Number(c.pix_price)).toFixed(2).replace(".", ",") : "",
        c.pix_price ? (c.received * Number(c.pix_price)).toFixed(2).replace(".", ",") : "",
        c.active ? "sim" : "não",
      ]),
    ]);
  }

  return (
    <>
      <PageTitle title="Painel">
        <button type="button" className="btn-outline" onClick={reload}>
          ↻ Atualizar
        </button>
        <button type="button" className="btn-primary" onClick={exportConsolidated} disabled={!loaded}>
          Exportar consolidado
        </button>
      </PageTitle>
      <LoadState loaded={loaded} error={error} />

      {loaded && !error && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Doações ativas" value={active.length} hint={`${donors} doadores únicos`} />
            <Stat
              label="Prometido"
              value={`${pct(committed, limitTotal)}%`}
              hint={`${committed} de ${limitTotal} doações · ${soldOut} itens esgotados`}
            />
            <Stat label="Recebido" value={`${pct(received, committed)}%`} hint={`${received} de ${committed} prometidas`} />
            <Stat label="PIX confirmado" value={brl(pixConfirmed)} hint={`de ${brl(pixExpected)} esperado`} />
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <Legend className="bg-brand-strong" label="Recebido" />
            <Legend className="bg-[#9fcbad]" label="Prometido (pendente)" />
            <Legend className="bg-line" label="Ainda disponível" />
          </div>

          {groupByCategory(catalog).map(([category, items]) => (
            <section key={category} className="card overflow-hidden">
              <h2 className="bg-ink px-5 py-3 font-display text-2xl tracking-wide text-white">{category}</h2>
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <ProgressRow key={it.id} item={it} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function ProgressRow({ item: it }: { item: CatalogItem }) {
  const w = (n: number) => `${it.limit_qty ? (n / it.limit_qty) * 100 : 0}%`;
  return (
    <li className={`grid gap-2 px-5 py-3 sm:grid-cols-[1fr_2fr_auto] sm:items-center ${it.active ? "" : "opacity-50"}`}>
      <div className="text-sm font-semibold">
        {it.name}
        {it.pix_price ? <span className="ml-2 text-[11px] font-bold text-wine">PIX</span> : null}
        {!it.active && <span className="ml-2 text-[11px] font-bold text-muted">inativo</span>}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line">
        <div className="bg-brand-strong" style={{ width: w(it.received) }} />
        <div className="bg-[#9fcbad]" style={{ width: w(it.committed - it.received) }} />
      </div>
      <div className="text-xs tabular-nums text-muted sm:w-52 sm:text-right">
        <b className="text-ink">{it.received}</b> rec. · <b className="text-ink">{it.committed}</b> prom. /{" "}
        {it.limit_qty}
        {it.remaining === 0 ? (
          <b className="ml-1 text-brand-strong">✓ completo</b>
        ) : (
          <span className="ml-1">· faltam {it.remaining}</span>
        )}
      </div>
    </li>
  );
}
