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

// ---------------------------------------------------------------- PDF (visual do Natal Solidário)

type RGB = [number, number, number];
const CREAM: RGB = [246, 244, 220];
const NATAL: RGB = [207, 36, 51];
const NATAL_DEEP: RGB = [154, 27, 49];
const NATAL_SHADOW: RGB = [226, 170, 176];
const FOREST: RGB = [23, 58, 31];
const GOLD: RGB = [240, 185, 58];
const INK: RGB = [35, 35, 37];
const MUTED: RGB = [102, 102, 107];
const LINE: RGB = [222, 219, 211];
const PINK: RGB = [246, 228, 230];
const WHITE: RGB = [255, 255, 255];

const W = 210;
const H = 297;
const M = 18; // margem
const BOTTOM = 262; // limite antes da faixa do rodapé

async function fetchBase64(src: string) {
  const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Gera e baixa o comprovante da doação prometida, no visual do Natal Solidário. */
export async function downloadDonationPdf(d: DonationSummary) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = d.settings;

  // Fontes do site (Lobster, Montserrat, Gochi Hand), embutidas no PDF.
  const fonts: [string, string, string][] = [
    ["Lobster-Regular.ttf", "Lobster", "normal"],
    ["Montserrat-Regular.ttf", "Montserrat", "normal"],
    ["Montserrat-Bold.ttf", "Montserrat", "bold"],
    ["Montserrat-ExtraBold.ttf", "MontserratXB", "normal"],
    ["GochiHand-Regular.ttf", "Gochi", "normal"],
  ];
  const [logo, tree, ...fontData] = await Promise.all([
    fetchBase64("/brand/logo-angelim-preto.png"),
    fetchBase64("/brand/arvore-branca.png"),
    ...fonts.map(([file]) => fetchBase64(`/fonts/${file}`)),
  ]);
  fonts.forEach(([file, family, style], i) => {
    doc.addFileToVFS(file, fontData[i]);
    doc.addFont(file, family, style);
  });

  // ---- helpers de desenho
  const font = (family: string, size: number, color: RGB, style = "normal") => {
    doc.setFont(family, style).setFontSize(size).setTextColor(...color);
  };
  const background = () => {
    doc.setFillColor(...CREAM).rect(0, 0, W, H, "F");
  };
  const polygon = (pts: [number, number][], fill: RGB, stroke?: RGB) => {
    const deltas = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
    doc.setFillColor(...fill);
    if (stroke) doc.setDrawColor(...stroke).setLineWidth(0.5);
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], stroke ? "FD" : "F", true);
  };
  // Estrela de quatro pontas, como os brilhos da arte.
  const sparkle = (cx: number, cy: number, r: number, color: RGB) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 - Math.PI / 2;
      const rr = k % 2 === 0 ? r : r * 0.22;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    polygon(pts, color);
  };
  // Retângulo girado (graus, sentido anti-horário) com sombra sólida deslocada.
  const tiltedBox = (cx: number, cy: number, w: number, h: number, deg: number, fill: RGB, shadow = 1.4) => {
    const a = (deg * Math.PI) / 180;
    const corners = ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as const).map(
      ([x, y]) => [cx + x * Math.cos(a) + y * Math.sin(a), cy - x * Math.sin(a) + y * Math.cos(a)] as [number, number],
    );
    polygon(corners.map(([x, y]) => [x + shadow, y + shadow]), INK);
    polygon(corners, fill, INK);
  };
  // Texto centralizado num retângulo girado.
  const tiltedText = (text: string, cx: number, cy: number, deg: number, sizePt: number) => {
    const a = (deg * Math.PI) / 180;
    const tw = doc.getTextWidth(text);
    const base = sizePt * 0.3528 * 0.35; // desce até a linha de base
    const x = cx - (tw / 2) * Math.cos(a) + base * Math.sin(a);
    const y = cy + (tw / 2) * Math.sin(a) + base * Math.cos(a);
    doc.text(text, x, y, { angle: deg });
  };
  // Cartão branco com contorno grafite e sombra deslocada (como no site).
  const card = (x: number, y: number, w: number, h: number) => {
    doc.setFillColor(...INK).roundedRect(x + 1.4, y + 1.4, w, h, 3, 3, "F");
    doc.setFillColor(...WHITE).setDrawColor(...INK).setLineWidth(0.5).roundedRect(x, y, w, h, 3, 3, "FD");
  };
  const header = (x: number, y: number, w: number, color: RGB, left: string, right?: string) => {
    doc.setFillColor(...color).setDrawColor(...INK).setLineWidth(0.5);
    doc.roundedRect(x, y, w, 10, 3, 3, "FD");
    doc.rect(x + 0.25, y + 5, w - 0.5, 5, "F"); // parte de baixo reta, encaixando no cartão
    doc.setDrawColor(...INK).line(x, y + 10, x + w, y + 10);
    font("MontserratXB", 10.5, WHITE);
    doc.text(left, x + 5, y + 6.7, { charSpace: 0.4 });
    if (right) {
      font("Montserrat", 10.5, WHITE, "bold");
      doc.text(right, x + w - 5, y + 6.7, { align: "right" });
    }
  };
  const ensureSpace = (y: number, need: number) => {
    if (y + need <= BOTTOM) return y;
    doc.addPage();
    background();
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", M, 12, 28, 7.1);
    font("Montserrat", 8, NATAL, "bold");
    doc.text(`Protocolo ${d.protocol} · continuação`, W - M, 17, { align: "right" });
    return 28;
  };

  // ---- topo: logo, letreiro e faixa
  background();
  doc.addImage(`data:image/png;base64,${logo}`, "PNG", M, 13, 32, 8.1);
  font("Montserrat", 7.5, NATAL, "bold");
  doc.text("CEIA DE NATAL 2026", W - M, 18.5, { align: "right", charSpace: 0.9 });

  sparkle(26, 46, 5.5, GOLD);
  sparkle(184, 36, 3.6, NATAL);
  sparkle(180, 78, 6, GOLD);
  sparkle(34, 82, 2.6, NATAL);

  font("Montserrat", 7, MUTED, "bold");
  doc.text("NATAL SOLIDÁRIO · MISSÃO ANGELIM", W / 2, 33, { align: "center", charSpace: 1.3 });

  font("Lobster", 46, NATAL_SHADOW);
  const title = "Ceia de Natal";
  doc.text(title, W / 2 + 0.9, 54 + 1.1, { align: "center" });
  font("Lobster", 46, NATAL);
  doc.text(title, W / 2, 54, { align: "center" });
  const titleW = doc.getTextWidth(title);

  tiltedBox(W / 2 + titleW / 2 + 2, 41.5, 15, 6.2, -12, GOLD, 0.8);
  font("MontserratXB", 9.5, INK);
  tiltedText("2026", W / 2 + titleW / 2 + 2, 41.5, -12, 9.5);

  tiltedBox(W / 2, 64.5, 118, 11.5, 2, NATAL);
  font("MontserratXB", 12.5, WHITE);
  tiltedText("•  COMPROVANTE DE DOAÇÃO  •", W / 2, 64.5, 2, 12.5);

  font("Gochi", 17, INK);
  doc.text("• Lagoa do Piauí •", W / 2, 81, { align: "center" });

  // ---- protocolo
  font("MontserratXB", 11, WHITE);
  const proto = `Protocolo ${d.protocol}`;
  const pw = doc.getTextWidth(proto) + 12;
  doc.setFillColor(...NATAL_DEEP).roundedRect(W / 2 - pw / 2, 86, pw, 9, 4.5, 4.5, "F");
  doc.text(proto, W / 2, 92, { align: "center" });
  font("Montserrat", 7.5, MUTED);
  const when = d.createdAt.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  });
  doc.text(`Registrado em ${when}`, W / 2, 100, { align: "center" });

  // ---- doador
  let y = 106;
  card(M, y, W - 2 * M, 18);
  const col = [M + 6, M + 66, M + 108];
  font("Montserrat", 6.8, MUTED, "bold");
  ["DOADOR", "TELEFONE", "E-MAIL"].forEach((t, i) => doc.text(t, col[i], y + 6.5, { charSpace: 0.5 }));
  font("Montserrat", 9.5, INK, "bold");
  doc.text(doc.splitTextToSize(d.name, 56)[0], col[0], y + 12.5);
  doc.text(d.phone, col[1], y + 12.5);
  doc.text(doc.splitTextToSize(d.email, 62)[0], col[2], y + 12.5);
  y += 26;

  const rowH = 7.5;
  const inner = W - 2 * M;

  // ---- via PIX
  if (d.pix.length) {
    font("Montserrat", 9, INK, "bold");
    const contactLines = doc.splitTextToSize(
      s.contacts.map((c) => `${c.name} ${c.phone}`).join("   ·   "),
      inner - 12,
    ) as string[];
    const h = 10 + d.pix.length * rowH + 4 + 16 + 4 + 6 + 5 + contactLines.length * 5 + 4;
    y = ensureSpace(y, h);
    card(M, y, inner, h);
    header(M, y, inner, NATAL, "VIA PIX", `Total ${brl(d.pixTotal)}`);
    let yy = y + 10;
    for (const it of d.pix) {
      font("Montserrat", 9.5, INK);
      doc.text(`${it.quantity}x  ${it.name}`, M + 6, yy + 5);
      font("Montserrat", 9.5, INK, "bold");
      doc.text(brl(it.value), M + inner - 6, yy + 5, { align: "right" });
      yy += rowH;
      doc.setDrawColor(...LINE).setLineWidth(0.25).line(M + 4, yy, M + inner - 4, yy);
    }
    yy += 4;
    doc.setFillColor(...PINK).roundedRect(M + 5, yy, inner - 10, 16, 2.5, 2.5, "F");
    font("Montserrat", 6.8, NATAL, "bold");
    doc.text("CHAVE PIX PARA PAGAMENTO", M + 10, yy + 5.5, { charSpace: 0.5 });
    font("Montserrat", 12.5, INK, "bold");
    doc.text(s.pix_key, M + 10, yy + 12);
    yy += 16 + 4;
    font("Montserrat", 9, INK, "bold");
    doc.text("Prazo:", M + 6, yy + 4);
    font("Montserrat", 9, INK);
    doc.text(s.pix_deadline, M + 20, yy + 4);
    yy += 6;
    font("Montserrat", 9, MUTED);
    doc.text("Depois de pagar, envie o comprovante (com seu nome e o item) para:", M + 6, yy + 4);
    yy += 5;
    font("Montserrat", 9, INK, "bold");
    contactLines.forEach((l, i) => doc.text(l, M + 6, yy + 4 + i * 5));
    y += h + 7;
  }

  // ---- entrega física
  if (d.physical.length) {
    const info: [string, string][] = [
      ["Data", s.delivery_deadline],
      ["Local", s.delivery_place],
      ["Horário (manhã)", s.morning_hours],
      ["Horário (tarde)", s.afternoon_hours],
    ];
    const h = 10 + d.physical.length * rowH + 4 + info.length * 5.5 + 3 + 7;
    y = ensureSpace(y, h);
    card(M, y, inner, h);
    header(M, y, inner, FOREST, "ENTREGA FÍSICA");
    let yy = y + 10;
    for (const it of d.physical) {
      font("Montserrat", 9.5, INK);
      doc.text(`${it.quantity}x  ${it.name}`, M + 6, yy + 5);
      yy += rowH;
      doc.setDrawColor(...LINE).setLineWidth(0.25).line(M + 4, yy, M + inner - 4, yy);
    }
    yy += 4;
    for (const [k, v] of info) {
      font("Montserrat", 9, INK, "bold");
      doc.text(`${k}:`, M + 6, yy + 4);
      font("Montserrat", 9, INK);
      doc.text(v, M + 40, yy + 4);
      yy += 5.5;
    }
    font("Montserrat", 8.5, MUTED);
    doc.text(`Entregue pessoalmente e informe seu nome ou o protocolo ${d.protocol}.`, M + 6, yy + 5);
  }

  // ---- rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NATAL_DEEP).rect(0, 270, W, 27, "F");
    font("Lobster", 17, WHITE);
    doc.text("Obrigado por fazer parte da nossa ceia!", M, 283);
    font("Montserrat", 7, [240, 214, 218]);
    doc.text("Missão Angelim · Igreja Batista Angelim Teresina · CNPJ 30.740.780/0001-77", M, 290);
    doc.addImage(`data:image/png;base64,${tree}`, "PNG", W - M - 15, 275.5, 15, 15);
  }

  doc.save(`doacao-ceia-2026-${d.protocol.replace("#", "")}.pdf`);
}
