"use client";

import { LoadState, PageTitle } from "@/components/admin/ui";
import { adminRpc } from "@/components/admin/use-admin-data";
import { dateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import { useEffect, useState } from "react";

// Datas são digitadas no horário de Teresina (UTC−3, sem horário de verão).
const toLocalInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16) : "";
const fromLocalInput = (v: string) => (v ? `${v}:00-03:00` : "");

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setSettings(data as Settings)));
  }, []);

  return (
    <>
      <PageTitle title="Configurações" />
      <LoadState loaded={!!settings} error={error} />
      {settings && (
        <SettingsForm
          key={settings.updated_at}
          initial={settings}
          onSaved={setSettings}
          msg={msg}
          setMsg={setMsg}
        />
      )}
    </>
  );
}

// A mensagem fica no componente pai: o formulário é recriado (key) ao salvar.
function SettingsForm({
  initial,
  onSaved,
  msg,
  setMsg,
}: {
  initial: Settings;
  onSaved: (s: Settings) => void;
  msg: string | null;
  setMsg: (m: string | null) => void;
}) {
  const [s, setS] = useState(initial);
  const [closesAt, setClosesAt] = useState(toLocalInput(initial.closes_at));
  const [pending, setPending] = useState(false);

  const text = (key: keyof Settings, label: string) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        className="field"
        value={String(s[key] ?? "")}
        onChange={(e) => setS({ ...s, [key]: e.target.value })}
      />
    </label>
  );

  async function save() {
    setPending(true);
    setMsg(null);
    const err = await adminRpc("admin_update_settings", {
      p: {
        form_open: s.form_open,
        closes_at: fromLocalInput(closesAt),
        delivery_deadline: s.delivery_deadline,
        delivery_place: s.delivery_place,
        morning_hours: s.morning_hours,
        afternoon_hours: s.afternoon_hours,
        pix_deadline: s.pix_deadline,
        pix_key: s.pix_key,
        contacts: s.contacts.filter((c) => c.name.trim() && c.phone.trim()),
      },
    });
    setPending(false);
    if (err) return setMsg(err);
    const { data } = await createClient().from("settings").select("*").eq("id", 1).single();
    setMsg("Configurações salvas.");
    if (data) onSaved(data as Settings);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="display text-3xl">Formulário</h2>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#3b7a52]"
            checked={s.form_open}
            onChange={(e) => setS({ ...s, form_open: e.target.checked })}
          />
          Formulário aberto para novas doações
        </label>
        <label className="block max-w-xs">
          <span className="mb-1 block text-sm font-semibold">Fechar automaticamente em (opcional)</span>
          <input
            type="datetime-local"
            className="field"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
          {initial.closes_at && (
            <span className="mt-1 block text-xs text-muted">Atual: {dateTime(initial.closes_at)}</span>
          )}
        </label>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="display text-3xl sm:col-span-2">Entrega física</h2>
        {text("delivery_deadline", "Prazo (ex.: até 14/12/2026)")}
        {text("delivery_place", "Local")}
        {text("morning_hours", "Horário manhã")}
        {text("afternoon_hours", "Horário tarde")}
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="display text-3xl sm:col-span-2">PIX</h2>
        {text("pix_deadline", "Prazo do PIX")}
        {text("pix_key", "Chave PIX")}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="display text-3xl">Contatos</h2>
        {s.contacts.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="field"
              placeholder="Nome"
              value={c.name}
              onChange={(e) =>
                setS({ ...s, contacts: s.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
              }
            />
            <input
              className="field"
              placeholder="(86) 9 0000-0000"
              value={c.phone}
              onChange={(e) =>
                setS({ ...s, contacts: s.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })
              }
            />
            <button
              type="button"
              aria-label="Remover contato"
              className="btn-ghost px-3 text-wine"
              onClick={() => setS({ ...s, contacts: s.contacts.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-outline px-4 py-1.5 text-xs"
          onClick={() => setS({ ...s, contacts: [...s.contacts, { name: "", phone: "" }] })}
        >
          + Adicionar contato
        </button>
      </section>

      <div className="flex items-center justify-end gap-4">
        {msg && <span className="text-sm font-medium text-amber">{msg}</span>}
        <button type="button" className="btn-primary px-8 py-3" disabled={pending} onClick={save}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
