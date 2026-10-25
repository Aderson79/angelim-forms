"use client";

import { submitDonation, type SubmitResult } from "@/app/actions";
import { brl, groupByCategory, isFormOpen, maskPhone, protocolLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { CatalogItem, Settings } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ContactList, InfoPanel, PixNotice } from "./info-panel";

const REFRESH_MS = 20_000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Qty = Record<number, number>;

export function DonationForm({
  initialCatalog,
  settings,
}: {
  initialCatalog: CatalogItem[];
  settings: Settings;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [qty, setQty] = useState<Qty>({});
  const [form, setForm] = useState({ email: "", name: "", phone: "", website: "" });
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: Extract<SubmitResult, { ok: true }>; qty: Qty; items: CatalogItem[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const qtyRef = useRef(qty);
  useEffect(() => {
    qtyRef.current = qty;
  }, [qty]);

  const open = isFormOpen(settings);
  const items = useMemo(() => catalog.filter((c) => c.active), [catalog]);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  // Atualiza o saldo e ajusta escolhas que deixaram de caber.
  const refresh = useCallback(async () => {
    const { data } = await createClient().rpc("get_catalog");
    if (!data) return;
    const fresh = data as CatalogItem[];
    setCatalog(fresh);
    const changed: string[] = [];
    const next: Qty = { ...qtyRef.current };
    for (const it of fresh) {
      const q = next[it.id] ?? 0;
      const max = it.active ? it.remaining : 0;
      if (q > max) {
        next[it.id] = max;
        changed.push(max ? `${it.name} (agora ${max})` : `${it.name} (esgotado)`);
      }
    }
    if (changed.length) {
      setQty(next);
      setNotice(`Outras pessoas acabaram de doar e o saldo mudou. Ajustamos: ${changed.join(", ")}.`);
    }
  }, []);

  useEffect(() => {
    if (done) return;
    const t = setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, done]);

  const selected = items.filter((it) => (qty[it.id] ?? 0) > 0);
  const totalUnits = selected.reduce((t, it) => t + qty[it.id], 0);
  const pixTotal = selected.reduce((t, it) => t + (it.pix_price ? qty[it.id] * Number(it.pix_price) : 0), 0);

  const errors = {
    email: !EMAIL_RE.test(form.email.trim()) ? "Informe um e-mail válido." : null,
    name: form.name.trim().length < 3 ? "Informe seu nome completo." : null,
    phone: ![10, 11].includes(form.phone.replace(/\D/g, "").length) ? "Informe o telefone com DDD." : null,
    items: selected.length === 0 ? "Escolha pelo menos um item." : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  function setItemQty(id: number, value: number) {
    const it = byId.get(id);
    if (!it) return;
    const clamped = Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, it.remaining));
    setQty((q) => ({ ...q, [id]: clamped }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid) {
      document.querySelector("[data-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const payload = selected.map((it) => ({ item_id: it.id, quantity: qty[it.id] }));
      const res = await submitDonation({ ...form, items: payload });
      if (res.ok) {
        setDone({ result: res, qty, items: selected });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const itemName = res.itemId ? byId.get(res.itemId)?.name : undefined;
      setError(itemName ? `${res.message} Item: ${itemName}.` : res.message);
      await refresh();
    });
  }

  if (done) {
    return (
      <Confirmation
        {...done}
        email={form.email.trim()}
        name={form.name.trim()}
        settings={settings}
        onRestart={() => {
          setDone(null);
          setQty({});
          setTouched(false);
          setNotice(null);
          refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <InfoPanel settings={settings} />

      {!open && (
        <div className="card border-amber/40 bg-amber-soft p-6 text-center">
          <p className="display text-3xl text-amber">Doações encerradas</p>
          <p className="mt-1 text-sm">
            Obrigado a todos que participaram! Em caso de dúvidas, fale com nossos contatos acima.
          </p>
        </div>
      )}

      {open && (
        <>
          <section className="card space-y-4 p-6">
            <h2 className="display text-3xl">Seus dados</h2>
            <Field label="E-mail" error={touched ? errors.email : null}>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="field"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Nome completo" error={touched ? errors.name : null}>
              <input
                autoComplete="name"
                className="field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Telefone" error={touched ? errors.phone : null}>
              <input
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="(86) 9 0000-0000"
                className="field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              />
            </Field>
            {/* Honeypot anti-robô: invisível para pessoas. */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </section>

          <section className="space-y-4" data-invalid={touched && !!errors.items}>
            <div className="flex items-end justify-between gap-4 px-1">
              <h2 className="display text-4xl">Escolha das doações</h2>
              <button type="button" onClick={refresh} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                ↻ Atualizar saldo
              </button>
            </div>
            <PixNotice settings={settings} />
            {touched && errors.items && (
              <p className="rounded-xl bg-wine-soft px-4 py-2 text-sm font-medium text-wine">{errors.items}</p>
            )}

            {groupByCategory(items).map(([category, list]) => (
              <div key={category} className="card overflow-hidden">
                <h3 className="border-b border-line bg-ink px-5 py-3 font-display text-2xl tracking-wide text-white">
                  {category}
                </h3>
                <ul className="divide-y divide-line">
                  {list.map((it) => (
                    <ItemRow key={it.id} item={it} value={qty[it.id] ?? 0} onChange={(v) => setItemQty(it.id, v)} />
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="sticky bottom-3 z-10">
            {(notice || error) && (
              <div
                role="alert"
                className={`mb-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                  error ? "bg-wine text-white" : "bg-amber-soft text-amber"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span>{error ?? notice}</span>
                  <button
                    type="button"
                    aria-label="Fechar aviso"
                    onClick={() => (error ? setError(null) : setNotice(null))}
                    className="opacity-70 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 text-white shadow-xl">
              <div className="text-sm">
                <p className="font-semibold">
                  {totalUnits === 0
                    ? "Nenhum item escolhido"
                    : `${totalUnits} ${totalUnits === 1 ? "doação escolhida" : "doações escolhidas"}`}
                </p>
                {pixTotal > 0 && <p className="text-white/70">PIX: {brl(pixTotal)}</p>}
              </div>
              <button type="submit" disabled={pending} className="btn-primary px-6 py-3">
                {pending ? "Enviando…" : "Confirmar doação"}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

function Field({ label, error, children }: { label: string; error: string | null; children: React.ReactNode }) {
  return (
    <label className="block" data-invalid={!!error}>
      <span className="mb-1.5 block text-sm font-semibold">
        {label} <span className="text-wine">*</span>
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-wine">{error}</span>}
    </label>
  );
}

function ItemRow({ item, value, onChange }: { item: CatalogItem; value: number; onChange: (v: number) => void }) {
  const soldOut = item.remaining <= 0;
  const pct = item.limit_qty ? Math.round((item.committed / item.limit_qty) * 100) : 100;

  return (
    <li className={`flex items-center gap-4 px-5 py-4 ${soldOut ? "bg-paper/70" : ""} ${value > 0 ? "bg-brand-soft/50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold ${soldOut ? "text-muted line-through" : ""}`}>{item.name}</span>
          {item.pix_price ? (
            <span className="rounded-full bg-wine-soft px-2 py-0.5 text-[11px] font-bold text-wine">
              PIX · {brl(Number(item.pix_price))} cada
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line sm:w-32" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs text-muted">
            {soldOut ? (
              <b className="text-wine">Esgotado</b>
            ) : (
              <>
                Restam <b className="text-ink">{item.remaining}</b> de {item.limit_qty}
              </>
            )}
          </span>
        </div>
      </div>

      {soldOut ? (
        <span className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted">
          Indisponível
        </span>
      ) : (
        <div className="flex shrink-0 items-center rounded-full border border-line bg-white">
          <button
            type="button"
            aria-label={`Diminuir ${item.name}`}
            onClick={() => onChange(value - 1)}
            disabled={value === 0}
            className="h-10 w-10 rounded-full text-lg font-bold hover:bg-ink/5 disabled:opacity-30"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            max={item.remaining}
            inputMode="numeric"
            aria-label={`Quantidade de ${item.name}`}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-10 bg-transparent text-center font-semibold outline-none"
          />
          <button
            type="button"
            aria-label={`Aumentar ${item.name}`}
            onClick={() => onChange(value + 1)}
            disabled={value >= item.remaining}
            className="h-10 w-10 rounded-full text-lg font-bold hover:bg-ink/5 disabled:opacity-30"
          >
            +
          </button>
        </div>
      )}
    </li>
  );
}

function Confirmation({
  result,
  qty,
  items,
  name,
  email,
  settings: s,
  onRestart,
}: {
  result: Extract<SubmitResult, { ok: true }>;
  qty: Qty;
  items: CatalogItem[];
  name: string;
  email: string;
  settings: Settings;
  onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pix = items.filter((it) => it.pix_price);
  const physical = items.filter((it) => !it.pix_price);
  const pixTotal = pix.reduce((t, it) => t + qty[it.id] * Number(it.pix_price), 0);
  const proto = protocolLabel(result.protocol);
  const receiptMsg =
    `Olá! Segue o comprovante da minha doação para a Ceia de Natal 2025.\n` +
    `Nome: ${name}\nProtocolo: ${proto}\n` +
    pix.map((it) => `• ${it.name} x${qty[it.id]} (${brl(qty[it.id] * Number(it.pix_price))})`).join("\n");

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-brand px-6 py-8 text-center text-white">
          <p className="text-4xl" aria-hidden>
            🎄
          </p>
          <h2 className="display mt-2 text-5xl">Obrigado, {name.split(" ")[0]}!</h2>
          <p className="mt-2 text-sm text-white/85">Sua doação foi registrada com sucesso.</p>
          <p className="mt-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold">
            Protocolo {proto}
          </p>
        </div>
        <ul className="divide-y divide-line px-6">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-4 py-3 text-sm">
              <span className="font-medium">{it.name}</span>
              <span className="shrink-0 text-muted">
                {qty[it.id]}x{it.pix_price ? ` · ${brl(qty[it.id] * Number(it.pix_price))}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {result.emailSent && (
          <p className="border-t border-line px-6 py-3 text-center text-xs text-muted">
            Enviamos uma cópia para <b>{email}</b>.
          </p>
        )}
      </section>

      {pix.length > 0 && (
        <section className="card space-y-4 border-wine/30 p-6">
          <h3 className="display text-3xl text-wine">Pagamento via PIX: {brl(pixTotal)}</h3>
          <p className="text-sm">
            Faça o PIX até <b>{s.pix_deadline}</b> para a chave abaixo e envie o comprovante, identificando seu
            nome e o item doado.
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-paper px-4 py-3">
            <span className="break-all font-semibold">{s.pix_key}</span>
            <button
              type="button"
              className="btn-outline ml-auto px-4 py-1.5 text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(s.pix_key);
                setCopied(true);
              }}
            >
              {copied ? "Copiado ✓" : "Copiar chave"}
            </button>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-semibold">Enviar comprovante pelo WhatsApp:</p>
            <ContactList contacts={s.contacts} message={receiptMsg} />
          </div>
        </section>
      )}

      {physical.length > 0 && (
        <section className="card space-y-3 p-6 text-sm">
          <h3 className="display text-3xl text-brand-strong">Entrega física</h3>
          <p>
            Entregue <b>pessoalmente</b> até <b>{s.delivery_deadline}</b> no <b>📍 {s.delivery_place}</b>.
          </p>
          <ul className="list-disc pl-5">
            <li>
              <b>Manhã:</b> {s.morning_hours}
            </li>
            <li>
              <b>Tarde:</b> {s.afternoon_hours}
            </li>
          </ul>
          <p className="text-muted">Informe seu nome ou o protocolo {proto} na entrega.</p>
        </section>
      )}

      <div className="text-center">
        <button type="button" onClick={onRestart} className="btn-outline">
          Fazer outra doação
        </button>
      </div>
    </div>
  );
}
