"use client";

import { whatsappLink } from "@/lib/format";
import type { CatalogItem, Contact, Settings } from "@/lib/types";
import { Suspense, use } from "react";

export type FormData = { catalog: CatalogItem[]; settings: Settings } | null;

/** Marcador discreto no lugar de um valor que ainda está vindo do banco. */
export function Skeleton({ w = "6rem", className = "" }: { w?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-[0.9em] animate-pulse rounded bg-line align-middle ${className}`}
      style={{ width: w }}
    />
  );
}

function Value({ data, pick }: { data: Promise<FormData>; pick: (s: Settings) => React.ReactNode }) {
  const d = use(data);
  return <>{d ? pick(d.settings) : "—"}</>;
}

/** Só o valor carrega; o texto em volta aparece na hora. */
export function Live({
  data,
  pick,
  w,
}: {
  data: Promise<FormData>;
  pick: (s: Settings) => React.ReactNode;
  w?: string;
}) {
  return (
    <Suspense fallback={<Skeleton w={w} />}>
      <Value data={data} pick={pick} />
    </Suspense>
  );
}

export function ContactList({ contacts, message }: { contacts: Contact[]; message?: string }) {
  return (
    <ul className="space-y-1.5">
      {contacts.map((c) => (
        <li key={c.phone}>
          <a
            href={whatsappLink(c.phone, message)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-medium hover:text-brand"
          >
            <span aria-hidden>📱</span>
            <b>{c.name}:</b> {c.phone}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function InfoPanel({ data }: { data: Promise<FormData> }) {
  return (
    <section className="card-natal overflow-hidden">
      <div className="border-b border-line px-6 py-5">
        <h2 className="font-extrabold tracking-tight text-2xl sm:text-3xl">Informações sobre as doações</h2>
        <p className="mt-1 text-sm text-muted">
          Você pode escolher quantos itens desejar para contribuir com a nossa ceia!
        </p>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="space-y-3 bg-card px-6 py-5 text-sm">
          <h3 className="flex items-center gap-2 font-bold">
            <span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand-strong">
              Entrega física
            </span>
            Alimentos não perecíveis
          </h3>
          <p>
            Devem ser entregues <b>pessoalmente</b>.
          </p>
          <ul className="space-y-0.5">
            <li>
              <b>Prazo:</b> <Live data={data} pick={(s) => s.delivery_deadline} />
            </li>
            <li>
              <b>Local:</b> 📍 <Live data={data} pick={(s) => s.delivery_place} w="9rem" />
            </li>
          </ul>
          <div>
            <p className="font-semibold">Horários para entrega:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <b>Manhã:</b> <Live data={data} pick={(s) => s.morning_hours} />
              </li>
              <li>
                <b>Tarde:</b> <Live data={data} pick={(s) => s.afternoon_hours} />
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3 bg-card px-6 py-5 text-sm">
          <h3 className="flex items-center gap-2 font-bold">
            <span className="rounded-full bg-wine-soft px-2.5 py-0.5 text-xs text-wine">PIX</span>
            Alimentos perecíveis
          </h3>
          <p>
            Através de <b>PIX</b>. Após realizar o pagamento, envie o comprovante para os números abaixo,
            identificando o item doado.
          </p>
          <p>
            <b>Prazo:</b> <Live data={data} pick={(s) => s.pix_deadline} />
          </p>
          <p>
            <span className="block font-semibold">🔑 Chave PIX:</span>
            <span className="font-medium text-brand-strong [overflow-wrap:anywhere]">
              <Live data={data} pick={(s) => s.pix_key} w="14rem" />
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-line px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold">Contatos para dúvidas:</p>
          <Suspense
            fallback={
              <div className="space-y-2.5">
                <Skeleton w="12rem" />
                <br />
                <Skeleton w="11rem" />
              </div>
            }
          >
            <Contacts data={data} />
          </Suspense>
        </div>
        <p className="font-bold">
          Fique atento aos prazos e colabore para tornar nossa ceia ainda mais especial!
        </p>
      </div>
    </section>
  );
}

function Contacts({ data }: { data: Promise<FormData> }) {
  const d = use(data);
  return d ? <ContactList contacts={d.settings.contacts} /> : <p>—</p>;
}

export function PixNotice({ data }: { data: Promise<FormData> }) {
  return (
    <div className="rounded-2xl border border-wine/25 bg-wine-soft/60 px-5 py-4 text-sm">
      <p className="font-bold text-wine">INFORMAÇÕES IMPORTANTES sobre as doações para a ceia</p>
      <p className="mt-1.5">
        Para facilitar o processo de doações dos alimentos da ceia, para alguns itens optamos por realizar as
        contribuições de forma digital, através de PIX. Conseguimos um desconto especial com um único
        fornecedor, o que nos permitirá otimizar os custos e garantir a qualidade dos itens.
      </p>
      <p className="mt-1.5">
        <b>Quem escolher uma das opções marcadas como PIX</b> deve realizar o pagamento para a chave abaixo e
        enviar o comprovante, identificando o nome do doador e o item doado.
      </p>
      <p className="mt-2 inline-block rounded-lg bg-white/80 px-3 py-1.5 font-bold text-wine [overflow-wrap:anywhere]">
        <Live data={data} pick={(s) => s.pix_key} w="16rem" />
      </p>
    </div>
  );
}
