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
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const categories = [...new Set(catalog.map((c) => c.category))];

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
          <section key={category} className="card mb-6 overflow-hidden">
            <h2 className="bg-ink px-5 py-3 font-display text-2xl tracking-wide text-white">{category}</h2>
            {/* Cabeçalho das colunas só no computador; no celular cada item vira um bloco. */}
            <div className="hidden grid-cols-[1fr_5rem_5rem_5rem_7rem_4rem_6rem] gap-2 border-b border-line px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
              <span>Item</span>
              <span className="text-right">Prometido</span>
              <span className="text-right">Recebido</span>
              <span className="text-right">Restante</span>
              <span>Limite</span>
              <span>Ativo</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <ItemRow
                  key={`${it.id}-${it.limit_qty}-${it.active}`}
                  item={it}
                  onEdit={() => setEditing(it)}
                  onSaved={async (msg) => {
                    setFlash(msg);
                    await reload();
                  }}
                />
              ))}
            </ul>
          </section>
        ))}

      <ItemDialog
        open={creating}
        categories={categories}
        onClose={() => setCreating(false)}
        onDone={async () => {
          setCreating(false);
          setFlash("Item criado.");
          await reload();
        }}
      />
      {editing && (
        <ItemDialog
          key={editing.id}
          open
          item={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            setFlash("Item corrigido.");
            await reload();
          }}
        />
      )}
    </>
  );
}

function ItemRow({
  item: it,
  onEdit,
  onSaved,
}: {
  item: CatalogItem;
  onEdit: () => void;
  onSaved: (msg: string) => void;
}) {
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
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-5 py-3 text-sm md:grid-cols-[1fr_5rem_5rem_5rem_7rem_4rem_6rem] md:gap-2 ${
        active ? "" : "bg-paper text-muted"
      }`}
    >
      <div className="col-span-2 font-medium md:col-span-1">
        {it.name}
        {it.pix_price ? (
          <span className="ml-2">
            <Badge tone="wine">PIX {brl(Number(it.pix_price))}</Badge>
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Editar ${it.name}`}
          className="ml-2 text-xs font-semibold text-muted underline hover:text-ink"
          onClick={onEdit}
        >
          Editar
        </button>
      </div>
      <p className="col-span-2 text-xs text-muted md:hidden">
        Prometido <b className="text-ink">{it.committed}</b> · Recebido <b className="text-ink">{it.received}</b> ·
        Restante <b className="text-ink">{it.remaining}</b>
      </p>
      <span className="hidden text-right tabular-nums md:block">{it.committed}</span>
      <span className="hidden text-right tabular-nums md:block">{it.received}</span>
      <span className="hidden text-right tabular-nums md:block">{it.remaining}</span>
      <div className="flex items-center gap-3 md:contents">
        <label className="flex items-center gap-2 md:block">
          <span className="text-xs font-semibold text-muted md:hidden">Limite</span>
          <input
            type="number"
            aria-label={`Limite de ${it.name}`}
            min={it.committed}
            className="field w-20 py-1.5 md:w-24"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 0)}
          />
        </label>
        <label className="flex items-center gap-2 md:block">
          <input
            type="checkbox"
            aria-label={`${it.name} ativo`}
            className="h-4 w-4"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span className="text-xs font-semibold text-muted md:hidden">Ativo</span>
        </label>
      </div>
      <div className="text-right">
        <button
          type="button"
          aria-label={`Salvar ${it.name}`}
          className="btn-primary px-4 py-1.5 text-xs"
          disabled={!dirty || pending}
          onClick={save}
        >
          Salvar
        </button>
      </div>
    </li>
  );
}

/** Cria um item novo ou, com `item`, corrige categoria, nome e valor PIX de um existente. */
function ItemDialog({
  open,
  item,
  categories,
  onClose,
  onDone,
}: {
  open: boolean;
  item?: CatalogItem;
  categories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const empty = item
    ? { category: item.category, name: item.name, limit: item.limit_qty, pix: item.pix_price ? String(item.pix_price).replace(".", ",") : "" }
    : { category: "", name: "", limit: 1, pix: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const fields = {
      p_category: form.category,
      p_name: form.name,
      p_pix_price: form.pix ? Number(form.pix.replace(",", ".")) : null,
    };
    const err = item
      ? await adminRpc("admin_edit_item", { p_id: item.id, ...fields })
      : await adminRpc("admin_create_item", { ...fields, p_limit: form.limit });
    if (err) return setError(err);
    setForm(empty);
    setError(null);
    onDone();
  }

  return (
    <Modal open={open} title={item ? "Editar item" : "Novo item"} onClose={onClose}>
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
          {/* Na edição o limite continua na própria linha, que valida contra o já prometido. */}
          {!item && (
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
          )}
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
            {item ? "Salvar correção" : "Criar item"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
