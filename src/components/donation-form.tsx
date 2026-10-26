"use client";

import { submitDonation, type SubmitResult } from "@/app/actions";
import { brl, groupByCategory, isFormOpen, maskPhone, protocolLabel, whatsappLink, whatsappShareLink } from "@/lib/format";
import { downloadDonationPdf, summaryMessage, type DonationSummary } from "@/lib/donation-pdf";
import { createClient } from "@/lib/supabase/client";
import type { CatalogItem, Settings } from "@/lib/types";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { InfoPanel, PixNotice, Skeleton, type FormData } from "./info-panel";

const REFRESH_MS = 20_000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Qty = Record<number, number>;
type Donor = { email: string; name: string; phone: string; website: string };
type Done = { result: Extract<SubmitResult, { ok: true }>; qty: Qty; items: CatalogItem[]; settings: Settings };

/*
 * A casca do formulário (textos, "Seus dados", títulos) aparece na hora.
 * Só os valores que vêm do banco carregam depois: configurações (cada valor com
 * seu próprio marcador) e a lista de itens com saldo.
 */
export function DonationForm({ data }: { data: Promise<FormData> }) {
  const [form, setForm] = useState<Donor>({ email: "", name: "", phone: "", website: "" });
  // Campos já visitados: o erro só aparece depois que a pessoa sai do campo.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const [done, setDone] = useState<Done | null>(null);
  const [closed, setClosed] = useState(false);
  const [restarts, setRestarts] = useState(0);
  const submitRef = useRef<(() => void) | null>(null);

  const errors = {
    email: !EMAIL_RE.test(form.email.trim()) ? "Informe um e-mail válido." : null,
    name: form.name.trim().length < 3 ? "Informe seu nome completo." : null,
    phone: ![10, 11].includes(form.phone.replace(/\D/g, "").length) ? "Informe o telefone com DDD." : null,
  };

  if (done) {
    return (
      <Confirmation
        {...done}
        email={form.email.trim()}
        name={form.name.trim()}
        phone={form.phone}
        onRestart={() => {
          setDone(null);
          setTouched({});
          setRestarts((n) => n + 1);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitRef.current?.();
      }}
      noValidate
      className="space-y-6"
    >
      <InfoPanel data={data} />

      {!closed && (
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
      )}

      {!closed && (
        <section className="space-y-4">
          <h2 className="px-1 font-extrabold tracking-tight text-2xl sm:text-3xl">
            Escolha das <span className="font-script font-normal tracking-normal text-natal">doações</span>
          </h2>
          <PixNotice data={data} />
        </section>
      )}

      <Suspense fallback={<ItemsSkeleton />}>
        <DonationItems
          key={restarts}
          data={data}
          form={form}
          donorErrors={errors}
          refreshOnMount={restarts > 0}
          submitRef={submitRef}
          onClosed={setClosed}
          onDone={setDone}
        />
      </Suspense>
    </form>
  );
}

/** Itens com saldo, barra de confirmação e envio. Só esta parte espera o banco. */
function DonationItems({
  data,
  form,
  donorErrors,
  refreshOnMount,
  submitRef,
  onClosed,
  onDone,
}: {
  data: Promise<FormData>;
  form: Donor;
  donorErrors: Record<"email" | "name" | "phone", string | null>;
  refreshOnMount: boolean;
  submitRef: React.RefObject<(() => void) | null>;
  onClosed: (closed: boolean) => void;
  onDone: (d: Done) => void;
}) {
  const initial = use(data);
  const settings = initial?.settings;
  const [catalog, setCatalog] = useState<CatalogItem[]>(initial?.catalog ?? []);
  const [qty, setQty] = useState<Qty>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const qtyRef = useRef(qty);
  useEffect(() => {
    qtyRef.current = qty;
  }, [qty]);

  const open = settings ? isFormOpen(settings) : true;
  useEffect(() => onClosed(!open), [open, onClosed]);

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
    // Ao voltar de "Fazer outra doação", busca o saldo atualizado na hora.
    const first = refreshOnMount ? setTimeout(refresh, 0) : undefined;
    const t = setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, refreshOnMount]);

  const selected = items.filter((it) => (qty[it.id] ?? 0) > 0);
  const totalUnits = selected.reduce((t, it) => t + qty[it.id], 0);
  const pixTotal = selected.reduce((t, it) => t + (it.pix_price ? qty[it.id] * Number(it.pix_price) : 0), 0);

  const missing = [
    donorErrors.email && "e-mail",
    donorErrors.name && "nome",
    donorErrors.phone && "telefone",
    selected.length === 0 && "ao menos um item",
  ].filter(Boolean);
  const valid = missing.length === 0;

  function setItemQty(id: number, value: number) {
    const it = byId.get(id);
    if (!it) return;
    const clamped = Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, it.remaining));
    setQty((q) => ({ ...q, [id]: clamped }));
  }

  function submit() {
    setError(null);
    if (!valid || !settings) return; // botão fica desabilitado; isto é só uma garantia extra
    startTransition(async () => {
      const payload = selected.map((it) => ({ item_id: it.id, quantity: qty[it.id] }));
      const res = await submitDonation({ ...form, items: payload });
      if (res.ok) {
        onDone({ result: res, qty, items: selected, settings });
        return;
      }
      const itemName = res.itemId ? byId.get(res.itemId)?.name : undefined;
      setError(itemName ? `${res.message} Item: ${itemName}.` : res.message);
      await refresh();
    });
  }
  useEffect(() => {
    submitRef.current = submit;
  });

  if (!initial) {
    return (
      <div className="card-natal p-8 text-center">
        <p className="font-semibold">Não foi possível carregar os itens.</p>
        <p className="mt-1 text-sm text-muted">Atualize a página em alguns instantes.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <ClosedNotice
        // Passou da data de fechamento automático: a campanha acabou.
        notice={settings?.form_open && settings.closes_at ? "encerrado" : (settings?.closed_notice ?? "em_breve")}
      />
    );
  }

  return (
    <>
      <div className="-mt-2 flex justify-end">
        <button type="button" onClick={refresh} className="btn-ghost px-3 py-1.5 text-xs">
          ↻ Atualizar saldo
        </button>
      </div>

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

      {/* Fica no fim do formulário; só flutua se o envio falhar, para o aviso ficar sempre à vista. */}
      <div className={error ? "sticky bottom-3 z-10" : "relative"}>
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
            {missing.length > 0 && <p className="text-xs text-white/60">Falta preencher: {missing.join(", ")}</p>}
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
  );
}

function ClosedNotice({ notice }: { notice: "em_breve" | "encerrado" }) {
  if (notice === "encerrado") {
    return (
      <div className="card-natal bg-amber-soft p-6 text-center">
        <p className="text-2xl font-extrabold tracking-tight text-amber">Doações encerradas</p>
        <p className="mt-1 text-sm">
          Obrigado a todos que participaram! Em caso de dúvidas, fale com nossos contatos acima.
        </p>
      </div>
    );
  }
  return (
    <div className="card-natal bg-white p-6 text-center">
      <p className="font-script text-4xl text-natal">Em breve!</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight">As doações ainda não foram abertas</p>
      <p className="mt-2 text-sm text-muted">
        Logo você poderá escolher os itens da ceia por aqui. Em caso de dúvidas, fale com nossos contatos acima.
      </p>
    </div>
  );
}

/** Esqueleto da lista de itens enquanto o saldo carrega (mesmo formato dos cartões). */
function ItemsSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Carregando itens">
      {[5, 3].map((rows, i) => (
        <div key={i} className="card-natal overflow-hidden">
          <div className="border-b-2 border-ink bg-forest px-5 py-3.5">
            <Skeleton w="11rem" className="bg-white/25" />
          </div>
          <ul className="divide-y divide-line">
            {Array.from({ length: rows }, (_, r) => (
              <li key={r} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton w={`${9 + ((r * 3) % 5)}rem`} />
                  <br />
                  <Skeleton w="7rem" className="h-2" />
                </div>
                <Skeleton w="7.5rem" className="h-10 rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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

  const [createdAt] = useState(() => new Date());
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

  const summary: DonationSummary = {
    protocol: proto,
    createdAt,
    name,
    phone,
    email,
    pix: pix.map((it) => ({ name: it.name, quantity: qty[it.id], value: pixValue(it) })),
    pixTotal,
    physical: physical.map((it) => ({ name: it.name, quantity: qty[it.id] })),
    settings: s,
  };
  const message = summaryMessage(summary);

  function copy(text: string, what: "key" | "summary") {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(what);
  }

  async function savePdf() {
    setPdfState("working");
    try {
      await downloadDonationPdf(summary);
      setPdfState("idle");
    } catch (e) {
      console.error(e);
      setPdfState("error");
    }
  }

  // Ao aparecer, o resumo vai para o topo da tela (sem voltar ao letreiro do início).
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const both = pix.length > 0 && physical.length > 0;

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      <article className="card-natal overflow-hidden print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-ink bg-natal-deep px-5 py-4 text-white sm:px-6 print:bg-white print:text-ink">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.25em] text-gold print:text-natal">RESUMO DA SUA DOAÇÃO</p>
            <h2 className="font-script text-3xl leading-tight sm:text-4xl">Obrigado, {name.split(" ")[0]}!</h2>
          </div>
          <p className="select-text rounded-full border-2 border-white/30 bg-white/10 px-4 py-1.5 text-sm font-bold">
            Protocolo {proto}
          </p>
        </header>

        <p className="select-text border-b border-line px-5 py-2.5 text-xs text-muted sm:px-6">
          <b className="text-ink">{name}</b> · {phone} · <span className="[overflow-wrap:anywhere]">{email}</span>
        </p>

        {/* Guardar: logo no topo, sem precisar rolar */}
        <div className="grid grid-cols-3 gap-2 border-b border-line bg-cream/70 px-4 py-3 sm:px-6 print:hidden">
          <button
            type="button"
            onClick={savePdf}
            disabled={pdfState === "working"}
            className="btn-natal px-2 py-2 text-[11px] leading-tight sm:text-xs"
          >
            {pdfState === "working" ? "Gerando…" : "Baixar PDF"}
          </button>
          <a
            href={whatsappShareLink(message)}
            target="_blank"
            rel="noreferrer"
            className="btn border-2 border-ink bg-[#25d366] px-2 py-2 text-center text-[11px] font-extrabold uppercase leading-tight text-ink shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-px sm:text-xs"
          >
            Enviar no WhatsApp
          </a>
          <button
            type="button"
            onClick={() => copy(message, "summary")}
            className="btn-outline border-2 px-2 py-2 text-[11px] leading-tight sm:text-xs"
          >
            {copied === "summary" ? "Mensagem copiada ✓" : "Copiar mensagem"}
          </button>
        </div>
        {pdfState === "error" && (
          <p className="border-b border-line px-6 py-2 text-xs font-medium text-wine">
            Não foi possível gerar o PDF neste aparelho. Use “Copiar mensagem” ou “Enviar no WhatsApp”.
          </p>
        )}

        <div className={`grid select-text divide-y divide-line ${both ? "md:grid-cols-2 md:divide-x md:divide-y-0" : ""}`}>
          {pix.length > 0 && (
            <section className="space-y-3 px-5 py-4 sm:px-6">
              <h3 className="flex items-baseline justify-between gap-2">
                <span className="select-none text-lg font-extrabold tracking-tight text-natal">Via PIX</span>
                <span className="text-sm font-semibold">
                  Total: <span className="text-base text-wine">{brl(pixTotal)}</span>
                </span>
              </h3>
              <SummaryList items={pix} qty={qty} value={pixValue} />
              <div className="rounded-xl bg-wine-soft/70 px-3 py-2">
                <p className="text-[11px] font-semibold text-wine">Chave PIX</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-bold [overflow-wrap:anywhere]">{s.pix_key}</span>
                  <button
                    type="button"
                    className="btn-outline px-3 py-1 text-[11px] print:hidden"
                    onClick={() => copy(s.pix_key, "key")}
                  >
                    {copied === "key" ? "Copiado ✓" : "Copiar chave"}
                  </button>
                </div>
              </div>
              <p className="text-sm">
                <b>Prazo:</b> {s.pix_deadline}
              </p>
              <div className="text-xs">
                <p className="mb-1.5 text-muted">Depois de pagar, envie o comprovante para:</p>
                <div className="flex flex-wrap gap-2">
                  {s.contacts.map((c) => (
                    <a
                      key={c.phone}
                      href={whatsappLink(c.phone, receiptMsg)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 font-semibold hover:border-brand hover:text-brand"
                    >
                      <span aria-hidden>📱</span>
                      {c.name} · {c.phone}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {physical.length > 0 && (
            <section className="space-y-3 px-5 py-4 sm:px-6">
              <h3 className="select-none text-lg font-extrabold tracking-tight text-forest">Entrega física</h3>
              <SummaryList items={physical} qty={qty} />
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ["Data", s.delivery_deadline],
                    ["Local", s.delivery_place],
                    ["Manhã", s.morning_hours],
                    ["Tarde", s.afternoon_hours],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-brand-soft/60 px-3 py-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-strong">{label}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">
                Entregue <b>pessoalmente</b> e informe seu nome ou o protocolo {proto}.
              </p>
            </section>
          )}
        </div>

        {result.emailSent && (
          <p className="border-t border-line px-6 py-2 text-center text-xs text-muted">
            Enviamos uma cópia para <b>{email}</b>.
          </p>
        )}
      </article>

      <div className="text-center print:hidden">
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
    <ul className="divide-y divide-line text-sm">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-4 py-1.5">
          <span>
            <b>{qty[it.id]}x</b> {it.name}
          </span>
          {value && <span className="shrink-0 font-semibold">{brl(value(it))}</span>}
        </li>
      ))}
    </ul>
  );
}
