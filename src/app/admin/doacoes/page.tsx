"use client";

import { EditDialog, VoidDialog } from "@/components/admin/donation-dialogs";
import { Badge, LoadState, PageTitle } from "@/components/admin/ui";
import { adminRpc, findDuplicates, useAdminData } from "@/components/admin/use-admin-data";
import { downloadCsv } from "@/lib/csv";
import { brl, dateTime, formatPhone, protocolLabel, whatsappLink } from "@/lib/format";
import type { CatalogItem, Donation } from "@/lib/types";
import { useMemo, useState } from "react";

type StatusFilter = "ativa" | "anulada" | "todas";
type ReceiptFilter = "todos" | "pendente" | "recebido";

export default function DonationsPage() {
  const { catalog, donations, loaded, error, reload } = useAdminData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ativa");
  const [receipt, setReceipt] = useState<ReceiptFilter>("todos");
  const [itemId, setItemId] = useState<number | "">("");
  const [onlyDup, setOnlyDup] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [voiding, setVoiding] = useState<Donation | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // Recebimentos sendo salvos: a caixa muda na hora e fica travada até o banco confirmar.
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const isDup = useMemo(() => findDuplicates(donations), [donations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return donations.filter((d) => {
      if (status !== "todas" && d.status !== status) return false;
      if (itemId !== "" && !d.donation_items.some((di) => di.item_id === itemId)) return false;
      const allReceived = d.donation_items.every((di) => di.received);
      if (receipt === "pendente" && allReceived) return false;
      if (receipt === "recebido" && !allReceived) return false;
      if (onlyDup && !isDup(d)) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.email.includes(q) ||
        (qDigits.length >= 3 && d.phone.includes(qDigits)) ||
        (qDigits !== "" && d.protocol === Number(qDigits))
      );
    });
  }, [donations, search, status, itemId, receipt, onlyDup, isDup]);

  async function run(fn: string, args: Record<string, unknown>, ok: string) {
    const err = await adminRpc(fn, args);
    setFlash(err ?? ok);
    await reload();
  }

  function exportDetailed() {
    downloadCsv("doacoes-detalhado.csv", [
      ["Protocolo", "Data", "Status", "Nome", "Telefone", "E-mail", "Categoria", "Item", "Quantidade", "Forma", "Valor PIX", "Recebido", "Recebido em", "Recebido por", "Observações", "Motivo anulação"],
      ...filtered.flatMap((d) =>
        d.donation_items.map((di) => {
          const it = byId.get(di.item_id);
          return [
            protocolLabel(d.protocol),
            dateTime(d.created_at),
            d.status,
            d.name,
            formatPhone(d.phone),
            d.email,
            it?.category,
            it?.name,
            di.quantity,
            it?.pix_price ? "PIX" : "Entrega física",
            it?.pix_price ? (di.quantity * Number(it.pix_price)).toFixed(2).replace(".", ",") : "",
            di.received ? "sim" : "não",
            di.received_at ? dateTime(di.received_at) : "",
            di.received_by ?? "",
            d.notes ?? "",
            d.void_reason ?? "",
          ];
        }),
      ),
    ]);
  }

  return (
    <>
      <PageTitle title="Doações">
        <button type="button" className="btn-outline" onClick={reload}>
          ↻ Atualizar
        </button>
        <button type="button" className="btn-primary" onClick={exportDetailed} disabled={!loaded}>
          Exportar ({filtered.length})
        </button>
      </PageTitle>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.4fr_auto] lg:items-center">
        <input
          aria-label="Buscar doações"
          className="field py-2"
          placeholder="Buscar por nome, telefone, e-mail ou protocolo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Status" className="field py-2" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="ativa">Ativas</option>
          <option value="anulada">Anuladas</option>
          <option value="todas">Todas</option>
        </select>
        <select aria-label="Recebimento" className="field py-2" value={receipt} onChange={(e) => setReceipt(e.target.value as ReceiptFilter)}>
          <option value="todos">Qualquer recebimento</option>
          <option value="pendente">Com pendências</option>
          <option value="recebido">Tudo recebido</option>
        </select>
        <select
          aria-label="Item"
          className="field py-2"
          value={itemId}
          onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Todos os itens</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
          <input type="checkbox" checked={onlyDup} onChange={(e) => setOnlyDup(e.target.checked)} />
          Possíveis duplicados
        </label>
      </div>

      {flash && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber">
          {flash}
          <button type="button" onClick={() => setFlash(null)} aria-label="Fechar">
            ✕
          </button>
        </div>
      )}

      <LoadState loaded={loaded} error={error} />
      {loaded && !error && (
        <>
          <p className="mb-3 text-sm text-muted">
            {filtered.length} de {donations.length} doações
          </p>
          <ul className="space-y-3">
            {filtered.map((d) => (
              <DonationCard
                key={d.id}
                donation={d}
                byId={byId}
                duplicate={isDup(d)}
                saving={saving}
                onToggleReceived={async (diId, received) => {
                  setSaving((s) => ({ ...s, [diId]: received }));
                  await run(
                    "admin_set_received",
                    { p_donation_item_id: diId, p_received: received },
                    received ? "Item marcado como recebido." : "Recebimento desfeito.",
                  );
                  setSaving((s) => {
                    const next = { ...s };
                    delete next[diId];
                    return next;
                  });
                }}
                onEdit={() => setEditing(d)}
                onVoid={() => setVoiding(d)}
                onRestore={() => run("admin_restore_donation", { p_id: d.id }, "Doação restaurada.")}
              />
            ))}
            {filtered.length === 0 && <li className="card p-6 text-center text-sm text-muted">Nenhuma doação.</li>}
          </ul>
        </>
      )}

      <EditDialog
        donation={editing}
        catalog={catalog}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null);
          setFlash("Doação atualizada.");
          await reload();
        }}
      />
      <VoidDialog
        donation={voiding}
        onClose={() => setVoiding(null)}
        onDone={async () => {
          setVoiding(null);
          setFlash("Doação anulada. O saldo dos itens foi devolvido.");
          await reload();
        }}
      />
    </>
  );
}

function DonationCard({
  donation: d,
  byId,
  duplicate,
  saving,
  onToggleReceived,
  onEdit,
  onVoid,
  onRestore,
}: {
  donation: Donation;
  byId: Map<number, CatalogItem>;
  duplicate: boolean;
  saving: Record<string, boolean>;
  onToggleReceived: (donationItemId: string, received: boolean) => void;
  onEdit: () => void;
  onVoid: () => void;
  onRestore: () => void;
}) {
  const voided = d.status === "anulada";
  const pending = d.donation_items.filter((di) => !di.received);
  const pixTotal = d.donation_items.reduce((t, di) => {
    const p = byId.get(di.item_id)?.pix_price;
    return t + (p ? di.quantity * Number(p) : 0);
  }, 0);

  const describe = (list: typeof d.donation_items) =>
    list.map((di) => `• ${byId.get(di.item_id)?.name} x${di.quantity}`).join("\n");
  const waText =
    `Olá, ${d.name.split(" ")[0]}! Aqui é da Missão Angelim. Obrigado por participar das doações para a Ceia de Natal 2026 🎄\n` +
    `Protocolo ${protocolLabel(d.protocol)}:\n${describe(d.donation_items)}` +
    (pending.length && pending.length < d.donation_items.length
      ? `\n\nAinda não registramos o recebimento de:\n${describe(pending)}`
      : "");

  return (
    <li className={`card overflow-hidden ${voided ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-muted">{protocolLabel(d.protocol)}</span>
            <span className={`font-semibold ${voided ? "line-through" : ""}`}>{d.name}</span>
            {voided && <Badge tone="wine">Anulada</Badge>}
            {duplicate && <Badge tone="amber">Possível duplicado</Badge>}
            {!voided && pending.length === 0 && <Badge tone="green">Tudo recebido</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{formatPhone(d.phone)}</span>
            <span className="break-all">{d.email}</span>
            <span>{dateTime(d.created_at)}</span>
            {pixTotal > 0 && <span className="font-semibold text-wine">PIX {brl(pixTotal)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsappLink(d.phone, waText)}
            target="_blank"
            rel="noreferrer"
            className="btn border border-[#25d366] px-3 py-1.5 text-xs text-[#128c4a] hover:bg-[#25d366]/10"
          >
            WhatsApp
          </a>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={onEdit}>
            Editar
          </button>
          {voided ? (
            <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={onRestore}>
              Restaurar
            </button>
          ) : (
            <button
              type="button"
              className="btn border border-wine/50 px-3 py-1.5 text-xs text-wine hover:bg-wine-soft"
              onClick={onVoid}
            >
              Anular
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-line">
        {d.donation_items.map((di) => {
          const it = byId.get(di.item_id);
          const isSaving = di.id in saving;
          const received = saving[di.id] ?? di.received;
          return (
            <li key={di.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
              <span>
                <b>{di.quantity}x</b> {it?.name}
                {it?.pix_price ? <span className="ml-2 text-[11px] font-bold text-wine">PIX</span> : null}
              </span>
              <label
                className={`flex cursor-pointer items-center gap-2 text-xs font-semibold ${
                  received ? "text-brand-strong" : "text-muted"
                }`}
                title={di.received_at ? `Por ${di.received_by} em ${dateTime(di.received_at)}` : undefined}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#3b7a52]"
                  checked={received}
                  disabled={voided || isSaving}
                  onChange={(e) => onToggleReceived(di.id, e.target.checked)}
                />
                {isSaving ? "Salvando…" : received ? (it?.pix_price ? "PIX confirmado" : "Recebido") : "Pendente"}
              </label>
            </li>
          );
        })}
      </ul>

      {(d.notes || d.void_reason) && (
        <div className="space-y-1 border-t border-line bg-paper px-5 py-2 text-xs">
          {d.notes && (
            <p>
              <b>Obs.:</b> {d.notes}
            </p>
          )}
          {d.void_reason && (
            <p className="text-wine">
              <b>Anulada</b> por {d.voided_by} em {d.voided_at && dateTime(d.voided_at)}: {d.void_reason}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
