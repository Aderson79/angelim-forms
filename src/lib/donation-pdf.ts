import { brl } from "./format";
import type { Settings } from "./types";

export type DonationSummary = {
  protocol: string;
  createdAt: Date;
  name: string;
  phone: string;
  email: string;
  pix: { name: string; quantity: number; value: number }[];
  pixTotal: number;
  physical: { name: string; quantity: number }[];
  settings: Settings;
};

/** Texto do resumo, usado em "Copiar mensagem" e "Enviar no WhatsApp". */
export function summaryMessage(d: DonationSummary) {
  const s = d.settings;
  return [
    `*Doação para a Ceia de Natal 2026* · Missão Angelim`,
    `Protocolo: *${d.protocol}*`,
    `Doador: ${d.name} · ${d.phone}`,
    ...(d.pix.length
      ? [
          ``,
          `*Via PIX (total ${brl(d.pixTotal)})*`,
          ...d.pix.map((i) => `• ${i.quantity}x ${i.name} = ${brl(i.value)}`),
          `Chave PIX: ${s.pix_key}`,
          `Prazo: ${s.pix_deadline}`,
          `Comprovante para: ${s.contacts.map((c) => `${c.name} ${c.phone}`).join(" / ")}`,
        ]
      : []),
    ...(d.physical.length
      ? [
          ``,
          `*Entrega física*`,
          ...d.physical.map((i) => `• ${i.quantity}x ${i.name}`),
          `Data: ${s.delivery_deadline}`,
          `Local: ${s.delivery_place}`,
          `Horários: manhã ${s.morning_hours} · tarde ${s.afternoon_hours}`,
        ]
      : []),
  ].join("\n");
}

async function loadImage(src: string) {
  const blob = await (await fetch(src)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Cores da página (Natal Solidário).
const NATAL_DEEP: [number, number, number] = [154, 27, 49];
const NATAL: [number, number, number] = [207, 36, 51];
const FOREST: [number, number, number] = [23, 58, 31];
const INK: [number, number, number] = [35, 35, 37];
const MUTED: [number, number, number] = [102, 102, 107];
const LINE: [number, number, number] = [222, 219, 211];

/** Gera e baixa o PDF de confirmação da doação prometida. */
export async function downloadDonationPdf(d: DonationSummary) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = d.settings;
  const W = 210;
  const M = 18; // margem
  let y = 0;

  // Cabeçalho vinho com a logo
  doc.setFillColor(...NATAL_DEEP);
  doc.rect(0, 0, W, 42, "F");
  try {
    doc.addImage(await loadImage("/logo-angelim.png"), "PNG", M, 10, 40, 10.1);
  } catch {
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(14).text("MISSÃO ANGELIM", M, 18);
  }
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(18);
  doc.text("Doação para a Ceia de Natal 2026", M, 31);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Comprovante de doação prometida · Natal Solidário · Lagoa do Piauí", M, 37);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(`Protocolo ${d.protocol}`, W - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(
    d.createdAt.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }),
    W - M,
    23,
    { align: "right" },
  );
  y = 54;

  const label = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(text, x, yy);
  };
  const value = (text: string, x: number, yy: number, maxW = 170) => {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK);
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, yy);
    return lines.length * 4.6;
  };
  const heading = (text: string, color: [number, number, number]) => {
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...color).text(text, M, y);
    y += 7;
  };
  const rule = () => {
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y, W - M, y);
    y += 8;
  };
  const table = (rows: [string, string][]) => {
    for (const [left, right] of rows) {
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
      doc.text(left, M + 3, y);
      if (right) doc.setFont("helvetica", "bold").text(right, W - M - 3, y, { align: "right" });
      y += 3;
      doc.setDrawColor(...LINE).line(M, y, W - M, y);
      y += 5;
    }
  };
  const info = (rows: [string, string][]) => {
    for (const [k, v] of rows) {
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text(`${k}:`, M, y);
      doc.setFont("helvetica", "normal").text(v, M + 38, y);
      y += 5.5;
    }
  };

  // Doador
  label("DOADOR", M, y);
  label("TELEFONE", M + 70, y);
  label("E-MAIL", M + 115, y);
  y += 5;
  value(d.name, M, y, 66);
  value(d.phone, M + 70, y, 42);
  value(d.email, M + 115, y, 60);
  y += 9;
  rule();

  if (d.pix.length) {
    heading(`Via PIX · total ${brl(d.pixTotal)}`, NATAL);
    table(d.pix.map((i) => [`${i.quantity}x ${i.name}`, brl(i.value)]));
    y += 2;
    doc.setFillColor(246, 228, 230).roundedRect(M, y - 5, W - 2 * M, 14, 2, 2, "F");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...NATAL).text("CHAVE PIX PARA PAGAMENTO", M + 4, y);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK).text(s.pix_key, M + 4, y + 6);
    y += 16;
    info([["Prazo", s.pix_deadline]]);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    doc.text("Após pagar, envie o comprovante identificando seu nome e o item doado para:", M, y);
    y += 5.5;
    info(s.contacts.map((c) => [c.name, c.phone] as [string, string]));
    y += 2;
    rule();
  }

  if (d.physical.length) {
    heading("Entrega física", FOREST);
    table(d.physical.map((i) => [`${i.quantity}x ${i.name}`, ""]));
    y += 2;
    info([
      ["Data", s.delivery_deadline],
      ["Local", s.delivery_place],
      ["Horário (manhã)", s.morning_hours],
      ["Horário (tarde)", s.afternoon_hours],
    ]);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text(`Entregue pessoalmente e informe seu nome ou o protocolo ${d.protocol}.`, M, y + 1);
    y += 8;
  }

  // Rodapé
  doc.setDrawColor(...LINE).line(M, 277, W - M, 277);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  doc.text("Missão Angelim · Igreja Batista Angelim Teresina · CNPJ 30.740.780/0001-77", M, 282);
  doc.text("Obrigado por fazer parte da nossa ceia!", W - M, 282, { align: "right" });

  doc.save(`doacao-ceia-2026-${d.protocol.replace("#", "")}.pdf`);
}
