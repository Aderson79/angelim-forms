import { brl, protocolLabel } from "./format";
import type { Settings } from "./types";

type Line = { name: string; quantity: number; pix_price: number | null };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Envia a cópia da doação ao doador. Sem RESEND_API_KEY, não faz nada. */
export async function sendDonationCopy(opts: {
  to: string;
  name: string;
  protocol: number;
  lines: Line[];
  settings: Settings;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const { to, name, protocol, lines, settings: s } = opts;
  const pix = lines.filter((l) => l.pix_price);
  const physical = lines.filter((l) => !l.pix_price);
  const pixTotal = pix.reduce((t, l) => t + l.quantity * Number(l.pix_price), 0);
  const contacts = s.contacts.map((c) => `${esc(c.name)}: ${esc(c.phone)}`).join("<br>");

  const row = (l: Line) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(l.name)}</td>` +
    `<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${l.quantity}x` +
    (l.pix_price ? ` · ${brl(l.quantity * Number(l.pix_price))}` : "") +
    `</td></tr>`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#232325">
  <div style="background:#232325;color:#fff;padding:24px;border-radius:12px 12px 0 0">
    <div style="font-size:12px;letter-spacing:2px;opacity:.7">MISSÃO ANGELIM</div>
    <div style="font-size:22px;font-weight:bold;margin-top:4px">Doações para a Ceia de Natal 2026</div>
  </div>
  <div style="border:1px solid #dedbd3;border-top:0;padding:24px;border-radius:0 0 12px 12px">
    <p>Olá, <b>${esc(name)}</b>! Obrigado por fazer parte da nossa ceia. 🎄</p>
    <p>Protocolo da sua doação: <b>${protocolLabel(protocol)}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${lines.map(row).join("")}</table>
    ${
      pix.length
        ? `<h3 style="margin-top:24px;color:#2b5c3c">Itens via PIX: ${brl(pixTotal)}</h3>
    <p>Faça o PIX para a chave <b>${esc(s.pix_key)}</b> e envie o comprovante,
    identificando seu nome e o item doado, para:<br>${contacts}</p>
    <p>Prazo: <b>${esc(s.pix_deadline)}</b></p>`
        : ""
    }
    ${
      physical.length
        ? `<h3 style="margin-top:24px;color:#2b5c3c">Entrega física</h3>
    <p>Entregue pessoalmente.<br>
    Prazo: <b>${esc(s.delivery_deadline)}</b><br>Local: <b>${esc(s.delivery_place)}</b><br>
    Manhã: ${esc(s.morning_hours)}<br>Tarde: ${esc(s.afternoon_hours)}</p>`
        : ""
    }
    <p style="margin-top:24px">Dúvidas? Fale com:<br>${contacts}</p>
    <p style="font-weight:bold">Fique atento aos prazos e colabore para tornar nossa ceia ainda mais especial!</p>
  </div>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Missão Angelim <onboarding@resend.dev>",
        to: [to],
        subject: `Sua doação para a Ceia de Natal 2026 · ${protocolLabel(protocol)}`,
        html,
      }),
    });
    if (!res.ok) console.error("Resend falhou", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend falhou", e);
    return false;
  }
}
