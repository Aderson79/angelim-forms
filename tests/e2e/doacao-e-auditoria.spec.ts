import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/*
 * Ponta a ponta contra o Supabase real: faz doações pelo formulário público e
 * exercita o painel (recebimento, edição, anulação, restauração, exportação, itens
 * e auditoria). As doações de teste levam "[TESTE E2E]" no nome e são anuladas no fim.
 */

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.E2E_SHOTS_DIR ?? "test-results/prints";
fs.mkdirSync(SHOTS, { recursive: true });

const RUN = String(Date.now()).slice(-6);
const TAG = "[TESTE E2E]";
const donor = {
  name: `Maria ${TAG} ${RUN}`,
  email: `e2e.${RUN}@exemplo.com`,
  phone: `869${RUN.padStart(8, "0")}`, // mesmo telefone nas duas doações → alerta de duplicado
};
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const hasAdmin = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

const protocols: string[] = [];

// ---------------------------------------------------------------- helpers

function itemRow(page: Page, name: string) {
  return page.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
}

async function remaining(page: Page, name: string) {
  const text = (await itemRow(page, name).textContent()) ?? "";
  if (/Esgotado/.test(text)) return 0;
  const m = text.match(/Restam\s*(\d+)/);
  if (!m) throw new Error(`Saldo não encontrado para ${name}: ${text}`);
  return Number(m[1]);
}

async function fillDonor(page: Page) {
  await page.getByLabel("E-mail").fill(donor.email);
  await page.getByLabel("Nome completo").fill(donor.name);
  await page.getByLabel("Telefone").fill(donor.phone);
}

async function add(page: Page, name: string, times = 1) {
  for (let i = 0; i < times; i++) await page.getByRole("button", { name: `Aumentar ${name}` }).click();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL!);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

function donationCard(page: Page, protocol: string) {
  return page
    .locator("li")
    .filter({ hasText: protocol })
    .filter({ has: page.getByRole("button", { name: "Editar" }) });
}

async function searchDonation(page: Page, protocol: string, status: "ativa" | "todas" = "ativa") {
  await page.goto("/admin/doacoes");
  await page.getByLabel("Status").selectOption(status);
  await page.getByLabel("Buscar doações").fill(protocol.replace("#", ""));
  await expect(donationCard(page, protocol)).toBeVisible();
  return donationCard(page, protocol);
}

// ---------------------------------------------------------------- formulário público

test("a logo leva ao site da Missão Angelim em nova aba", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: /Site da Missão Angelim/ }).first();
  await expect(logo).toHaveAttribute("href", "https://www.angelim.org");
  await expect(logo).toHaveAttribute("target", "_blank");
});

test("só as informações são selecionáveis, não os textos decorativos", async ({ page }) => {
  await page.goto("/");
  const userSelect = (loc: ReturnType<Page["locator"]>) =>
    loc.evaluate((el) => getComputedStyle(el).userSelect || getComputedStyle(el).webkitUserSelect);

  expect(await userSelect(page.getByRole("heading", { level: 1 }))).toBe("none");
  expect(await userSelect(page.getByText("Informações sobre as doações"))).toBe("none");
  // valores vindos do banco: chave PIX e contatos
  const key = page.getByText("institutovidaabencoada@gmail.com").first();
  await expect(key).toBeVisible();
  expect(await userSelect(key)).toBe("text");
  expect(await userSelect(page.getByText("(86) 9 8800-6865").first())).toBe("text");
  // campos de digitação continuam funcionando
  await page.getByLabel("Nome completo").fill("Teste de seleção");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Teste de seleção");
});

test("bloqueia a confirmação sem dados e sem itens", async ({ page }) => {
  await page.goto("/");
  const confirm = page.getByRole("button", { name: "Confirmar doação" });

  await expect(confirm).toBeDisabled();
  await expect(page.getByText("Falta preencher: e-mail, nome, telefone, ao menos um item")).toBeVisible();

  // e-mail inválido mostra o erro ao sair do campo
  await page.getByLabel("E-mail").fill("invalido");
  await page.getByLabel("Nome completo").click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();

  // só itens, sem dados: continua bloqueado
  await add(page, "Arroz 5kg");
  await expect(confirm).toBeDisabled();
  await expect(page.getByText("Falta preencher: e-mail, nome, telefone")).toBeVisible();

  // só dados, sem itens: continua bloqueado
  await page.getByRole("button", { name: "Diminuir Arroz 5kg" }).click();
  await fillDonor(page);
  await expect(confirm).toBeDisabled();
  await expect(page.getByText("Falta preencher: ao menos um item")).toBeVisible();
});

test("não deixa escolher mais que o saldo do item", async ({ page }) => {
  await page.goto("/");
  const item = "Luva descartável 2 caixas";
  const left = await remaining(page, item);
  test.skip(left === 0, "item já esgotado");

  const plus = page.getByRole("button", { name: `Aumentar ${item}` });
  const qty = page.getByRole("spinbutton", { name: `Quantidade de ${item}` });
  await add(page, item, left);
  await expect(plus).toBeDisabled();
  await expect(qty).toHaveValue(String(left));

  await qty.fill("99"); // digitar acima do saldo é limitado ao saldo
  await expect(qty).toHaveValue(String(left));
});

test("faz uma doação (PIX + entrega física) e gera o resumo", async ({ page }) => {
  await page.goto("/");
  const before = {
    frango: await remaining(page, "Frango 2kg"),
    arroz: await remaining(page, "Arroz 5kg"),
    oleo: await remaining(page, "Óleo 2L"),
  };

  await fillDonor(page);
  await add(page, "Frango 2kg", 2);
  await add(page, "Arroz 5kg", 1);
  await add(page, "Óleo 2L", 1);

  await expect(page.getByText(/4 doações escolhidas/)).toBeVisible();
  await expect(page.getByText(/PIX R\$\s74,00/)).toBeVisible();

  const confirm = page.getByRole("button", { name: "Confirmar doação" });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Resumo
  await expect(page.getByRole("heading", { name: "Obrigado, Maria!" })).toBeVisible();
  const protocolText = await page.getByText(/^Protocolo #\d+$/).textContent();
  const protocol = protocolText!.match(/#\d+/)![0];
  protocols.push(protocol);

  const summary = page.locator("article");
  await expect(summary).toContainText(donor.name);
  await expect(summary).toContainText("2x Frango 2kg");
  await expect(summary).toContainText(/Total:\s*R\$\s74,00/);
  await expect(summary).toContainText("institutovidaabencoada@gmail.com");
  await expect(summary).toContainText("1x Arroz 5kg");
  await expect(summary).toContainText("1x Óleo 2L");
  await expect(summary).toContainText("A definir");

  await page.screenshot({ path: path.join(SHOTS, "resumo-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(SHOTS, "resumo-celular.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Exportar: copiar mensagem
  await page.getByRole("button", { name: "Copiar mensagem" }).click();
  await expect(page.getByRole("button", { name: "Mensagem copiada ✓" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(protocol);
  expect(copied).toContain("2x Frango 2kg");
  expect(copied).toContain("institutovidaabencoada@gmail.com");
  fs.writeFileSync(path.join(SHOTS, "mensagem-copiada.txt"), copied);

  // Exportar: WhatsApp com o texto pronto
  const wa = await page.getByRole("link", { name: "Enviar no WhatsApp" }).getAttribute("href");
  expect(wa).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(wa!.split("text=")[1])).toContain(protocol);

  // Exportar: PDF
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`doacao-ceia-2026-${protocol.slice(1)}.pdf`);
  const pdfPath = path.join(SHOTS, download.suggestedFilename());
  await download.saveAs(pdfPath);
  const pdf = fs.readFileSync(pdfPath);
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.length).toBeGreaterThan(5_000);

  // O saldo diminuiu exatamente o que foi doado
  await page.goto("/");
  expect(await remaining(page, "Frango 2kg")).toBe(before.frango - 2);
  expect(await remaining(page, "Arroz 5kg")).toBe(before.arroz - 1);
  expect(await remaining(page, "Óleo 2L")).toBe(before.oleo - 1);
});

test("segunda doação com o mesmo telefone (para o alerta de duplicado)", async ({ page }) => {
  await page.goto("/");
  await fillDonor(page);
  await add(page, "Cenoura 2kg", 1);
  await page.getByRole("button", { name: "Confirmar doação" }).click();
  await expect(page.getByRole("heading", { name: "Obrigado, Maria!" })).toBeVisible();
  const protocolText = await page.getByText(/^Protocolo #\d+$/).textContent();
  protocols.push(protocolText!.match(/#\d+/)![0]);
});

// ---------------------------------------------------------------- painel / auditoria

test("o painel exige login", async ({ page }) => {
  // O botão "Área da equipe" da página pública leva ao login
  await page.goto("/");
  await page.getByRole("link", { name: "Área da equipe" }).click();
  await expect(page).toHaveURL(/\/login$/);
  // e o "Voltar" do login retorna ao formulário
  await page.getByRole("link", { name: "← Voltar ao formulário" }).click();
  await expect(page.getByRole("button", { name: "Confirmar doação" })).toBeVisible();
  await page.getByRole("link", { name: "Área da equipe" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/admin/doacoes");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("E-mail").fill("ninguem@exemplo.com");
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test.describe("painel administrativo", () => {
  test.skip(!hasAdmin, "defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD no .env.local");

  test("recebimento, edição, anulação, restauração e exportação", async ({ page }) => {
    const [p1] = protocols;
    await login(page);
    await expect(page.getByText("Doações ativas")).toBeVisible();

    let card = await searchDonation(page, p1);
    await expect(card.getByText("Possível duplicado")).toBeVisible();

    // Marcar o PIX do frango como confirmado
    const frango = card.locator("li").filter({ hasText: "Frango 2kg" });
    await frango.getByRole("checkbox").check();
    await expect(page.getByText("Item marcado como recebido.")).toBeVisible();
    await expect(frango).toContainText("PIX confirmado");

    // Editar quantidade e observação
    await card.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("spinbutton", { name: "Quantidade de Arroz 5kg" }).fill("2");
    await dialog.getByLabel("Observações internas").fill("Ligar antes da entrega (E2E)");
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Doação atualizada.")).toBeVisible();
    card = donationCard(page, p1);
    await expect(card).toContainText("2x Arroz 5kg");
    await expect(card).toContainText("Ligar antes da entrega (E2E)");
    await card.screenshot({ path: path.join(SHOTS, "admin-doacao.png") });

    // Anular com motivo
    await card.getByRole("button", { name: "Anular" }).click();
    await page.getByRole("dialog").getByLabel("Motivo").fill("Teste E2E automatizado");
    await page.getByRole("dialog").getByRole("button", { name: "Anular doação" }).click();
    await expect(page.getByText("Doação anulada. O saldo dos itens foi devolvido.")).toBeVisible();
    await expect(donationCard(page, p1)).toHaveCount(0); // some da lista de ativas

    card = await searchDonation(page, p1, "todas");
    await expect(card.getByText("Anulada", { exact: true }).first()).toBeVisible();
    await expect(card).toContainText("Teste E2E automatizado");

    // Restaurar
    await card.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText("Doação restaurada.")).toBeVisible();
    await expect(card.getByText("Anulada", { exact: true })).toHaveCount(0);

    // Exportar CSV
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Exportar \(/ }).click(),
    ]);
    const csvPath = path.join(SHOTS, "doacoes-exportadas.csv");
    await download.saveAs(csvPath);
    const csv = fs.readFileSync(csvPath, "utf8");
    expect(csv).toContain(p1);
    expect(csv).toContain("Frango 2kg");
    expect(csv).toContain("Ligar antes da entrega (E2E)");
  });

  test("sair volta ao login limpo, com o botão Entrar ativo", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
    await expect(page.getByLabel("Senha")).toHaveValue("");
  });

  test("alterar limite de item fica registrado", async ({ page }) => {
    await login(page);
    await page.goto("/admin/itens");
    const item = "Touca descartável 1 caixa";
    const limit = page.getByRole("spinbutton", { name: `Limite de ${item}` });
    const original = await limit.inputValue();

    const save = page.getByRole("button", { name: `Salvar ${item}` });

    await limit.fill(String(Number(original) + 1));
    await save.click();
    await expect(page.getByText(`"${item}" atualizado.`)).toBeVisible();
    await expect(save).toBeDisabled(); // linha recarregada com o valor salvo
    await expect(limit).toHaveValue(String(Number(original) + 1));

    // volta ao valor original
    await limit.fill(original);
    await save.click();
    await expect(save).toBeDisabled();
    await expect(limit).toHaveValue(original);
  });

  test("a auditoria mostra todas as ações", async ({ page }) => {
    await login(page);
    await page.goto("/admin/auditoria");
    // registros da auditoria (o seletor de ações tem opções com os mesmos nomes)
    const log = page.getByRole("list");
    await page.getByLabel("Buscar na auditoria").fill(RUN);
    for (const label of [
      "Item recebido",
      "Quantidade alterada",
      "Dados editados",
      "Doação anulada",
      "Doação restaurada",
    ]) {
      await expect(log.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await page.getByLabel("Só ações da equipe").uncheck();
    await expect(log.getByText("Doação criada", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "auditoria.png"), fullPage: true });

    await page.getByLabel("Buscar na auditoria").fill("Touca descartável");
    await expect(log.getByText("Item alterado", { exact: true }).first()).toBeVisible();
  });

  test("mudanças nas configurações aparecem na página pública", async ({ page, browser }) => {
    const changes: Record<string, string> = {
      "Prazo (ex.: até 14/12/2026)": `20/12/2026 (E2E ${RUN})`,
      Local: `Campus Teste E2E ${RUN}`,
      "Horário manhã": "07h00 às 11h00 (E2E)",
      "Horário tarde": "15h00 às 19h00 (E2E)",
      "Prazo do PIX": `18/12/2026 (E2E ${RUN})`,
    };
    const open = () => page.getByLabel("Formulário aberto para novas doações");
    const save = async () => {
      await page.getByRole("button", { name: "Salvar configurações" }).click();
      await expect(page.getByText("Configurações salvas.")).toBeVisible();
    };

    await login(page);
    await page.goto("/admin/configuracoes");
    const originals: Record<string, string> = {};
    for (const [label, value] of Object.entries(changes)) {
      const input = page.getByLabel(label, { exact: true });
      originals[label] = await input.inputValue();
      await input.fill(value);
    }
    await save();

    const pub = await browser.newPage(); // visitante anônimo
    try {
      await pub.goto("/");
      for (const value of Object.values(changes)) {
        await expect(pub.getByText(value).first()).toBeVisible();
      }
      await pub.screenshot({ path: path.join(SHOTS, "config-refletida.png") });

      // Fechar o formulário pelo painel
      await page.goto("/admin/configuracoes");
      await open().uncheck();
      await save();
      await pub.reload();
      await expect(pub.getByText("Doações encerradas")).toBeVisible();
      await expect(pub.getByRole("button", { name: "Confirmar doação" })).toHaveCount(0);
    } finally {
      // Restaura os valores originais e reabre o formulário
      await page.goto("/admin/configuracoes");
      for (const [label, value] of Object.entries(originals)) {
        await page.getByLabel(label, { exact: true }).fill(value);
      }
      await open().check();
      await save();
    }

    await pub.reload();
    await expect(pub.getByRole("button", { name: "Confirmar doação" })).toBeVisible();
    for (const value of Object.values(changes)) {
      await expect(pub.getByText(value)).toHaveCount(0);
    }
    await pub.close();
  });

  // Limpeza: anula toda doação de teste ainda ativa (desta rodada ou de rodadas que falharam).
  test("limpeza: anula as doações de teste", async ({ page }) => {
    await login(page);
    await page.goto("/admin/doacoes");
    await page.getByLabel("Status").selectOption("ativa");
    await page.getByLabel("Buscar doações").fill(TAG);
    await expect(page.getByText(/\d+ de \d+ doações/)).toBeVisible();

    const anular = page.getByRole("button", { name: "Anular", exact: true });
    while ((await anular.count()) > 0) {
      const before = await anular.count();
      await anular.first().click();
      await page.getByRole("dialog").getByLabel("Motivo").fill("Limpeza do teste E2E");
      await page.getByRole("dialog").getByRole("button", { name: "Anular doação" }).click();
      await expect(anular).toHaveCount(before - 1);
    }
    await expect(page.getByText("Nenhuma doação.")).toBeVisible();
  });
});
