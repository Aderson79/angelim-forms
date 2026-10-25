import type { CatalogItem, Settings } from "./types";

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

// Máscara progressiva para o campo de telefone enquanto o doador digita.
export function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function whatsappLink(phone: string, text?: string) {
  let d = phone.replace(/\D/g, "");
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Abre o WhatsApp com o texto pronto, para a pessoa escolher o contato (ou a si mesma). */
export const whatsappShareLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const brl =(n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const protocolLabel = (n: number) => `#${String(n).padStart(4, "0")}`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function isFormOpen(s: Settings) {
  return s.form_open && (!s.closes_at || new Date(s.closes_at) > new Date());
}

export function groupByCategory(items: CatalogItem[]) {
  const groups = new Map<string, CatalogItem[]>();
  for (const it of items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category)!.push(it);
  }
  return [...groups.entries()];
}

const ERRORS: Record<string, string> = {
  FORM_CLOSED: "As doações estão encerradas no momento.",
  INVALID_NAME: "Informe o nome completo.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  INVALID_PHONE: "Informe um telefone válido com DDD.",
  NO_ITEMS: "Escolha pelo menos um item.",
  INVALID_QTY: "Quantidade inválida.",
  ITEM_UNAVAILABLE: "Um dos itens não está mais disponível.",
  OVER_LIMIT: "A quantidade ultrapassa o saldo disponível do item.",
  NOT_ADMIN: "Sua conta não tem permissão de administrador.",
  NOT_FOUND: "Registro não encontrado (talvez já tenha sido alterado).",
  REASON_REQUIRED: "Informe o motivo.",
  LAST_ITEM: "A doação precisa ter pelo menos um item. Para cancelar tudo, anule a doação.",
  LIMIT_BELOW_COMMITTED: "O limite não pode ser menor que a quantidade já prometida.",
};

/** Converte "OVER_LIMIT:14" em { code, itemId, message }. */
export function parseDbError(message: string | undefined) {
  if (message?.includes("items_name_key")) {
    return { code: "DUPLICATE_ITEM", itemId: undefined, message: "Já existe um item com esse nome." };
  }
  const [code, arg] = (message ?? "").split(":");
  return {
    code,
    itemId: arg ? Number(arg) : undefined,
    message: ERRORS[code] ?? "Não foi possível concluir. Tente novamente.",
  };
}
