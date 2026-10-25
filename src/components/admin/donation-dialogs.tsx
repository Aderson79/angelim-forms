"use client";

import { formatPhone, maskPhone, protocolLabel } from "@/lib/format";
import type { CatalogItem, Donation } from "@/lib/types";
import { useState } from "react";
import { Modal } from "./ui";
import { adminRpc } from "./use-admin-data";

export function VoidDialog({
  donation,
  onClose,
  onDone,
}: {
  donation: Donation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (!donation) return;
    setPending(true);
    const err = await adminRpc("admin_void_donation", { p_id: donation.id, p_reason: reason });
    setPending(false);
    if (err) return setError(err);
    setReason("");
    setError(null);
    onDone();
  }

  return (
    <Modal open={!!donation} title="Anular doação" onClose={onClose}>
      {donation && (
        <div className="space-y-4 text-sm">
          <p>
            A doação <b>{protocolLabel(donation.protocol)}</b> de <b>{donation.name}</b> deixará de contar no
            saldo e os itens voltarão a ficar disponíveis. Nada é apagado: é possível restaurar depois.
          </p>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Motivo *</span>
            <textarea
              className="field min-h-24"
              placeholder="Ex.: preencheu duas vezes, desistiu, telefone errado…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && <p className="font-medium text-wine">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={pending || reason.trim().length < 3}
              onClick={confirm}
            >
              {pending ? "Anulando…" : "Anular doação"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function EditDialog({
  donation,
  catalog,
  onClose,
  onDone,
}: {
  donation: Donation | null;
  catalog: CatalogItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal open={!!donation} title="Editar doação" onClose={onClose}>
      {donation && (
        <EditForm key={donation.id} donation={donation} catalog={catalog} onClose={onClose} onDone={onDone} />
      )}
    </Modal>
  );
}

function EditForm({
  donation: d,
  catalog,
  onClose,
  onDone,
}: {
  donation: Donation;
  catalog: CatalogItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const [form, setForm] = useState({
    name: d.name,
    email: d.email,
    phone: maskPhone(d.phone),
    notes: d.notes ?? "",
  });
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(d.donation_items.map((di) => [di.id, di.quantity])),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const errs: string[] = [];
    const contactChanged =
      form.name !== d.name ||
      form.email !== d.email ||
      form.phone.replace(/\D/g, "") !== d.phone ||
      form.notes !== (d.notes ?? "");
    if (contactChanged) {
      const err = await adminRpc("admin_update_donation_contact", {
        p_id: d.id,
        p_name: form.name,
        p_email: form.email,
        p_phone: form.phone,
        p_notes: form.notes,
      });
      if (err) errs.push(`Dados: ${err}`);
    }
    for (const di of d.donation_items) {
      if (qty[di.id] === di.quantity) continue;
      const err = await adminRpc("admin_update_donation_item", {
        p_donation_item_id: di.id,
        p_quantity: qty[di.id],
      });
      if (err) errs.push(`${byId.get(di.item_id)?.name}: ${err}`);
    }
    setPending(false);
    setErrors(errs);
    if (!errs.length) onDone();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-semibold">Nome</span>
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">E-mail</span>
          <input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Telefone</span>
          <input
            className="field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-semibold">Observações internas</span>
          <textarea
            className="field min-h-20"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
      </div>

      <div>
        <p className="mb-2 font-semibold">Itens (0 remove o item)</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {d.donation_items.map((di) => {
            const it = byId.get(di.item_id);
            // máximo = o que já é desta doação + o saldo livre do item
            const max = d.status === "ativa" ? di.quantity + (it?.remaining ?? 0) : 9999;
            return (
              <li key={di.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {it?.name}
                  <span className="ml-2 text-xs text-muted">máx. {max}</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={max}
                  className="field w-20 py-1.5 text-center"
                  value={qty[di.id]}
                  onChange={(e) => setQty({ ...qty, [di.id]: Math.max(0, Number(e.target.value) || 0) })}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-wine-soft px-4 py-3 font-medium text-wine">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Telefone atual: {formatPhone(d.phone)} · Toda alteração fica registrada na auditoria.
      </p>
    </div>
  );
}
