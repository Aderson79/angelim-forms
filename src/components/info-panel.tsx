import { whatsappLink } from "@/lib/format";
import type { Contact, Settings } from "@/lib/types";

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

export function InfoPanel({ settings: s }: { settings: Settings }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-6 py-5">
        <h2 className="display text-3xl">Informações sobre as doações</h2>
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
            Até o dia <b>{s.delivery_deadline}</b>, entregues <b>pessoalmente</b> no{" "}
            <b>📍 {s.delivery_place}</b>.
          </p>
          <div>
            <p className="font-semibold">Horários para entrega:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <b>Manhã:</b> {s.morning_hours}
              </li>
              <li>
                <b>Tarde:</b> {s.afternoon_hours}
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
            Até o dia <b>{s.pix_deadline}</b>, através de <b>PIX</b>. Após realizar o pagamento, envie o
            comprovante para os números abaixo, identificando o item doado.
          </p>
          <p>
            <span className="font-semibold">🔑 Chave PIX:</span>{" "}
            <span className="break-all font-medium text-brand-strong">{s.pix_key}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-line px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold">Contatos para dúvidas:</p>
          <ContactList contacts={s.contacts} />
        </div>
        <div className="space-y-2">
          <p className="font-bold">
            Fique atento aos prazos e colabore para tornar nossa ceia ainda mais especial!
          </p>
          <p className="text-muted">
            <b>OBS.:</b> Ao confirmar o preenchimento do formulário será enviada uma cópia para o e-mail
            cadastrado.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PixNotice({ settings: s }: { settings: Settings }) {
  return (
    <div className="rounded-2xl border border-wine/25 bg-wine-soft/60 px-5 py-4 text-sm">
      <p className="font-bold text-wine">INFORMAÇÕES IMPORTANTES sobre as doações para a ceia</p>
      <p className="mt-1.5">
        Para facilitar o processo de doações dos alimentos da ceia, para alguns itens optamos por realizar as
        contribuições de forma digital, através de PIX. Conseguimos um desconto especial com um único
        fornecedor, o que nos permitirá otimizar os custos e garantir a qualidade dos itens.
      </p>
      <p className="mt-1.5">
        <b>Quem escolher uma das opções marcadas como PIX</b> deve realizar o pagamento para a chave{" "}
        <b className="break-all">{s.pix_key}</b> e enviar o comprovante, identificando o nome do doador e o
        item doado.
      </p>
    </div>
  );
}
