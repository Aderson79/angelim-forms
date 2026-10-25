"use client";

import { useEffect, useRef } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(100%-2rem,36rem)] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl"
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-card px-6 py-4">
            <h2 className="display text-3xl">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="btn-ghost px-3">
              ✕
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="display text-5xl">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function LoadState({ loaded, error }: { loaded: boolean; error: string | null }) {
  if (error) return <p className="card p-6 text-sm text-wine">Erro: {error}</p>;
  if (!loaded) return <p className="card p-6 text-sm text-muted">Carregando…</p>;
  return null;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "wine" | "amber";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-ink/5 text-ink",
    green: "bg-brand-soft text-brand-strong",
    wine: "bg-wine-soft text-wine",
    amber: "bg-amber-soft text-amber",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
