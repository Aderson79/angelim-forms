"use client";

import { Badge, LoadState, Modal, PageTitle } from "@/components/admin/ui";
import { adminRpc, useAdminData } from "@/components/admin/use-admin-data";
import { brl, groupByCategory } from "@/lib/format";
import type { CatalogItem } from "@/lib/types";
import { useState } from "react";

export default function ItemsPage() {
  const { catalog, loaded, error, reload } = useAdminData();
  const [flash, setFlash] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageTitle title="Itens e limites">
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          + Novo item
        </button>
      </PageTitle>
      <p className="mb-4 text-sm text-muted">
        O limite não pode ficar abaixo do que já foi prometido. Itens inativos somem do formulário, mas as
        doações existentes continuam valendo.
      </p>
      {flash && <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber">{flash}</p>}
      <LoadState loaded={loaded} error={error} />

      {loaded &&
        !error &&
        groupByCategory(catalog).map(([category, items]) => (
          <section key={category} className="card mb-6 overflow-x-auto">
            <h2 className="bg-ink px-5 py-3 font-display text-2xl tracking-wide text-white">{category}</h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2">Item</th>
                  <th className="px-2 py-2 text-right">Prometido</th>
                  <th className="px-2 py-2 text-right">Recebido</th>
                  <th className="px-2 py-2 text-right">Restante</th>
                  <th className="px-2 py-2">Limite</th>
                  <th className="px-2 py-2">Ativo</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((it) => (
                  <ItemRow
                    key={`${it.id}-${it.limit_qty}-${it.active}`}
                    item={it}
                    onSaved={async (msg) => {
                      setFlash(msg);
                      await reload();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </section>
        ))}

      <NewItemDialog
        open={creating}
        categories={[...new Set(catalog.map((c) => c.category))]}
        onClose={() => setCreating(false)}
        onDone={async () => {
          setCreating(false);
          setFlash("Item criado.");
          await reload();
        }}
      />
    </>
  );
}

function ItemRow({ item: it, onSaved }: { item: CatalogItem; onSaved: (msg: string) => void }) {
  const [limit, setLimit] = useState(it.limit_qty);
  const [active, setActive] = useState(it.active);
  const [pending, setPending] = useState(false);
  const dirty = limit !== it.limit_qty || active !== it.active;

  async function save() {
    setPending(true);
    const err = await adminRpc("admin_update_item", { p_id: it.id, p_limit: limit, p_active: active });
    setPending(false);
    onSaved(err ?? `"${it.name}" atualizado.`);
  }

  return (
    <tr className={active ? "" : "bg-paper text-muted"}>
      <td className="px-5 py-2 font-medium">
        {it.name}
        {it.pix_price ? (
          <span className="ml-2">
            <Badge tone="wine">PIX {brl(Number(it.pix_price))}</Badge>
          </span>
        ) : null}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{it.committed}</td>
      <td className="px-2 py-2 text-right tabular-nums">{it.received}</td>
      <td className="px-2 py-2 text-right tabular-nums">{it.remaining}</td>
      <td className="px-2 py-2">
        <input
          type="number"
          aria-label={`Limite de ${it.name}`}
          min={it.committed}
          className="field w-24 py-1.5"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 0)}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          aria-label={`${it.name} ativo`}
          className="h-4 w-4"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </td>
      <td className="px-5 py-2 text-right">
        <button
          type="button"
          aria-label={`Salvar ${it.name}`}
          className="btn-primary px-4 py-1.5 text-xs"
          disabled={!dirty || pending}
          onClick={save}
        >
          Salvar
        </button>
      </td>
    </tr>
  );
}

function NewItemDialog({
  open,
  categories,
  onClose,
  onDone,
}: {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ category: "", name: "", limit: 1, pix: "" });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const err = await adminRpc("admin_create_item", {
      p_category: form.category,
      p_name: form.name,
      p_limit: form.limit,
      p_pix_price: form.pix ? Number(form.pix.replace(",", ".")) : null,
    });
    if (err) return setError(err);
    setForm({ category: "", name: "", limit: 1, pix: "" });
    setError(null);
    onDone();
  }

  return (
    <Modal open={open} title="Novo item" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block font-semibold">Categoria</span>
          <input
            className="field"
            list="categories"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Nome (com a unidade, ex.: “Feijão 1kg”)</span>
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-semibold">Limite</span>
            <input
              type="number"
              min={0}
              className="field"
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Valor PIX (vazio = entrega física)</span>
            <input
              inputMode="decimal"
              className="field"
              placeholder="ex.: 37,00"
              value={form.pix}
              onChange={(e) => setForm({ ...form, pix: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="font-medium text-wine">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Criar item
          </button>
        </div>
      </div>
    </Modal>
  );
}
