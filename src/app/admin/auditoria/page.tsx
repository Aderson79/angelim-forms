"use client";

import { Badge, LoadState, PageTitle } from "@/components/admin/ui";
import { dateTime, protocolLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AuditEntry } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const ACTIONS: Record<string, { label: string; tone: "neutral" | "green" | "wine" | "amber" }> = {
  doacao_criada: { label: "Doação criada", tone: "green" },
  doacao_anulada: { label: "Doação anulada", tone: "wine" },
  doacao_restaurada: { label: "Doação restaurada", tone: "green" },
  item_recebido: { label: "Item recebido", tone: "green" },
  item_recebimento_desfeito: { label: "Recebimento desfeito", tone: "amber" },
  quantidade_alterada: { label: "Quantidade alterada", tone: "amber" },
  dados_editados: { label: "Dados editados", tone: "amber" },
  item_alterado: { label: "Item alterado", tone: "neutral" },
  item_criado: { label: "Item criado", tone: "neutral" },
  configuracoes_alteradas: { label: "Configurações", tone: "neutral" },
};

type Row = AuditEntry & { donations: { protocol: number; name: string } | null };

export default function AuditPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [hideForm, setHideForm] = useState(true);

  useEffect(() => {
    createClient()
      .from("audit_log")
      .select("*, donations(protocol, name)")
      .order("id", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data as Row[])));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!action || r.action === action) &&
        (!hideForm || r.actor !== "formulário" || action === "doacao_criada") &&
        (!q || JSON.stringify(r).toLowerCase().includes(q)),
    );
  }, [rows, action, search, hideForm]);

  return (
    <>
      <PageTitle title="Auditoria" />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto] sm:items-center">
        <input
          aria-label="Buscar na auditoria"
          className="field py-2"
          placeholder="Buscar (nome, item, responsável, motivo…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="field py-2" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Todas as ações</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
          <input type="checkbox" checked={hideForm} onChange={(e) => setHideForm(e.target.checked)} />
          Só ações da equipe
        </label>
      </div>

      <LoadState loaded={!!rows} error={error} />
      {rows && (
        <ul className="card divide-y divide-line">
          {filtered.map((r) => {
            const a = ACTIONS[r.action] ?? { label: r.action, tone: "neutral" as const };
            return (
              <li key={r.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                <div className="text-xs text-muted">
                  {dateTime(r.created_at)}
                  <div className="truncate font-medium text-ink">{r.actor}</div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.tone}>{a.label}</Badge>
                    {r.donations && (
                      <span className="font-medium">
                        {protocolLabel(r.donations.protocol)} · {r.donations.name}
                      </span>
                    )}
                  </div>
                  <Details action={r.action} details={r.details} />
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted">Nenhum registro.</li>}
        </ul>
      )}
    </>
  );
}

function Details({ action, details: d }: { action: string; details: Record<string, unknown> }) {
  const line = (() => {
    switch (action) {
      case "doacao_anulada":
        return `Motivo: ${d.motivo}`;
      case "item_recebido":
      case "item_recebimento_desfeito":
        return String(d.item);
      case "quantidade_alterada":
        return `${d.item}: ${d.de} → ${d.para}${d.para === 0 ? " (removido)" : ""}`;
      case "item_alterado":
        return `${d.item}: limite ${d.limite_de} → ${d.limite_para}${d.ativo_de !== d.ativo_para ? ` · ${d.ativo_para ? "ativado" : "desativado"}` : ""}`;
      case "item_criado":
        return `${d.item} (${d.categoria}) · limite ${d.limite}`;
      case "dados_editados": {
        const antes = d.antes as Record<string, unknown>;
        const depois = d.depois as Record<string, unknown>;
        return Object.keys(depois)
          .filter((k) => antes[k] !== depois[k])
          .map((k) => `${k}: “${antes[k] ?? ""}” → “${depois[k] ?? ""}”`)
          .join(" · ");
      }
      default:
        return null;
    }
  })();
  return line ? <p className="mt-1 text-xs text-muted">{line}</p> : null;
}
