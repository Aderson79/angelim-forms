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
  // Campos já visitados: o erro só aparece depois que a pessoa sai do campo.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
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
  const missing = [
    errors.email && "e-mail",
    errors.name && "nome",
    errors.phone && "telefone",
    errors.items && "ao menos um item",
  ].filter(Boolean);

  function setItemQty(id: number, value: number) {
    const it = byId.get(id);
    if (!it) return;
    const clamped = Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, it.remaining));
    setQty((q) => ({ ...q, [id]: clamped }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valid) return; // botão fica desabilitado; isto é só uma garantia extra
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
        phone={form.phone}
        settings={settings}
        onRestart={() => {
          setDone(null);
          setQty({});
          setTouched({});
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
        <div className="card-natal bg-amber-soft p-6 text-center">
          <p className="font-extrabold tracking-tight text-2xl text-amber">Doações encerradas</p>
          <p className="mt-1 text-sm">
            Obrigado a todos que participaram! Em caso de dúvidas, fale com nossos contatos acima.
          </p>
        </div>
      )}

      {open && (
        <>
          <section className="card-natal space-y-4 p-6">
            <h2 className="font-extrabold tracking-tight text-2xl sm:text-3xl">Seus dados</h2>
            <Field label="E-mail" error={touched.email ? errors.email : null}>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="field"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={blur("email")}
              />
            </Field>
            <Field label="Nome completo" error={touched.name ? errors.name : null}>
              <input
                autoComplete="name"
                className="field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={blur("name")}
              />
            </Field>
            <Field label="Telefone" error={touched.phone ? errors.phone : null}>
              <input
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="(86) 9 0000-0000"
                className="field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                onBlur={blur("phone")}
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

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 px-1">
              <h2 className="font-extrabold tracking-tight text-2xl sm:text-3xl">Escolha das <span className="font-script font-normal tracking-normal text-natal">doações</span></h2>
              <button type="button" onClick={refresh} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                ↻ Atualizar saldo
              </button>
            </div>
            <PixNotice settings={settings} />

            {groupByCategory(items).map(([category, list]) => (
              <div key={category} className="card-natal overflow-hidden">
                <h3 className="border-b-2 border-ink bg-forest px-5 py-3 text-base font-extrabold uppercase tracking-wider text-white">
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
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-forest px-5 py-4 text-white shadow-[5px_5px_0_var(--color-ink)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {totalUnits === 0
                    ? "Nenhum item escolhido"
                    : `${totalUnits} ${totalUnits === 1 ? "doação escolhida" : "doações escolhidas"}`}
                  {pixTotal > 0 && <span className="font-normal text-white/70"> · PIX {brl(pixTotal)}</span>}
                </p>
                {missing.length > 0 && (
                  <p className="text-xs text-white/60">Falta preencher: {missing.join(", ")}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={pending || !valid}
                title={valid ? undefined : `Falta preencher: ${missing.join(", ")}`}
                className="btn-natal w-full shrink-0 whitespace-nowrap px-6 py-3 sm:w-auto"
              >
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
    <label className="block">
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
    <li className={`flex items-center gap-4 px-5 py-4 ${soldOut ? "bg-paper/70" : ""} ${value > 0 ? "bg-cream" : ""}`}>
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
          <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-line sm:w-32" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
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
  phone,
  settings: s,
  onRestart,
}: {
  result: Extract<SubmitResult, { ok: true }>;
  qty: Qty;
  items: CatalogItem[];
  name: string;
  email: string;
  phone: string;
  settings: Settings;
  onRestart: () => void;
}) {
  const [copied, setCopied] = useState<"key" | "summary" | null>(null);
  const pix = items.filter((it) => it.pix_price);
  const physical = items.filter((it) => !it.pix_price);
  const pixValue = (it: CatalogItem) => qty[it.id] * Number(it.pix_price);
  const pixTotal = pix.reduce((t, it) => t + pixValue(it), 0);
  const proto = protocolLabel(result.protocol);
  const receiptMsg =
    `Olá! Segue o comprovante da minha doação para a Ceia de Natal 2026.\n` +
    `Nome: ${name}\nProtocolo: ${proto}\n` +
    pix.map((it) => `• ${it.name} x${qty[it.id]} (${brl(pixValue(it))})`).join("\n");

  // Versão em texto do resumo, para o doador guardar (WhatsApp, notas…).
  const summaryText = [
    `RESUMO DA DOAÇÃO · Ceia de Natal 2026 · Missão Angelim`,
    `Protocolo: ${proto}`,
    `Doador: ${name} · ${phone} · ${email}`,
    ...(pix.length
      ? [
          ``,
          `VIA PIX (total ${brl(pixTotal)})`,
          ...pix.map((it) => `• ${qty[it.id]}x ${it.name} = ${brl(pixValue(it))}`),
          `Chave PIX: ${s.pix_key}`,
          `Prazo: ${s.pix_deadline}`,
          `Enviar comprovante para: ${s.contacts.map((c) => `${c.name} ${c.phone}`).join(" / ")}`,
        ]
      : []),
    ...(physical.length
      ? [
          ``,
          `ENTREGA FÍSICA`,
          ...physical.map((it) => `• ${qty[it.id]}x ${it.name}`),
          `Data: ${s.delivery_deadline}`,
          `Local: ${s.delivery_place}`,
          `Horários: manhã ${s.morning_hours} · tarde ${s.afternoon_hours}`,
        ]
      : []),
  ].join("\n");

  function copy(text: string, what: "key" | "summary") {
    navigator.clipboard?.writeText(text);
    setCopied(what);
  }

  return (
    <div className="space-y-6">
      <article className="card-natal overflow-hidden print:border-0 print:shadow-none">
        <header className="border-b-2 border-ink bg-natal-deep px-6 py-8 text-center text-white print:bg-white print:text-ink">
          <p className="text-xs font-bold tracking-[0.3em] text-gold print:text-natal">RESUMO DA SUA DOAÇÃO</p>
          <h2 className="mt-2 font-script text-5xl sm:text-6xl">Obrigado, {name.split(" ")[0]}!</h2>
          <p className="mt-2 text-sm text-white/80 print:text-muted">
            Sua doação foi registrada. Guarde este resumo com o que você se comprometeu a doar.
          </p>
          <p className="mt-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold print:border print:border-line">
            Protocolo {proto}
          </p>
        </header>

        <dl className="grid gap-x-6 gap-y-1 border-b border-line px-6 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Doador</dt>
            <dd className="font-semibold">{name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Telefone</dt>
            <dd className="font-semibold">{phone}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">E-mail</dt>
            <dd className="font-semibold [overflow-wrap:anywhere]">{email}</dd>
          </div>
        </dl>

        {pix.length > 0 && (
          <section className="space-y-4 border-b border-line px-6 py-5">
            <h3 className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-extrabold tracking-tight text-2xl text-natal">Via PIX</span>
              <span className="text-sm font-semibold">
                Total: <span className="text-lg text-wine">{brl(pixTotal)}</span>
              </span>
            </h3>
            <SummaryList items={pix} qty={qty} value={pixValue} />
            <div className="rounded-xl bg-wine-soft/60 px-4 py-3">
              <p className="text-xs font-semibold text-wine">Chave PIX para pagamento</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold [overflow-wrap:anywhere] sm:text-base">{s.pix_key}</span>
                <button
                  type="button"
                  className="btn-outline ml-auto px-4 py-1.5 text-xs print:hidden"
                  onClick={() => copy(s.pix_key, "key")}
                >
                  {copied === "key" ? "Copiado ✓" : "Copiar chave"}
                </button>
              </div>
            </div>
            <InfoLines lines={[["Prazo", s.pix_deadline]]} />
            <div className="text-sm">
              <p className="mb-2">
                Após pagar, envie o comprovante identificando seu nome e o item doado:
              </p>
              <ContactList contacts={s.contacts} message={receiptMsg} />
            </div>
          </section>
        )}

        {physical.length > 0 && (
          <section className="space-y-4 px-6 py-5">
            <h3 className="font-extrabold tracking-tight text-2xl text-forest">Entrega física</h3>
            <SummaryList items={physical} qty={qty} />
            <InfoLines
              lines={[
                ["Data", s.delivery_deadline],
                ["Local", `📍 ${s.delivery_place}`],
                ["Horário (manhã)", s.morning_hours],
                ["Horário (tarde)", s.afternoon_hours],
              ]}
            />
            <p className="text-sm text-muted">
              Entregue <b>pessoalmente</b> e informe seu nome ou o protocolo {proto}.
            </p>
          </section>
        )}

        {result.emailSent && (
          <p className="border-t border-line px-6 py-3 text-center text-xs text-muted">
            Enviamos uma cópia para <b>{email}</b>.
          </p>
        )}
      </article>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <button type="button" onClick={() => copy(summaryText, "summary")} className="btn-natal">
          {copied === "summary" ? "Resumo copiado ✓" : "Copiar resumo"}
        </button>
        <button type="button" onClick={() => window.print()} className="btn-outline">
          Imprimir / salvar PDF
        </button>
        <button type="button" onClick={onRestart} className="btn-ghost">
          Fazer outra doação
        </button>
      </div>
    </div>
  );
}

function SummaryList({
  items,
  qty,
  value,
}: {
  items: CatalogItem[];
  qty: Qty;
  value?: (it: CatalogItem) => number;
}) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line text-sm">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span>
            <b>{qty[it.id]}x</b> {it.name}
          </span>
          {value && <span className="shrink-0 font-semibold">{brl(value(it))}</span>}
        </li>
      ))}
    </ul>
  );
}

function InfoLines({ lines }: { lines: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {lines.map(([label, v]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}:</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
