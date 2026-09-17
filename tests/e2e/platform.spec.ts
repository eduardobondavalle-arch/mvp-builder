import { test, expect } from "@playwright/test";
import { createInitialData } from "../src-fixture";

test.beforeEach(async ({ page }) => {
  const data = createInitialData();
  await page.addInitScript((snapshot) => {
    if (!localStorage.getItem("adim-platform:v1"))
      localStorage.setItem("adim-platform:v1", JSON.stringify(snapshot));
  }, data);
});
test("abre sem login e mantém as telas comerciais", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveURL(/dashboard/);
  for (const path of [
    "/dashboard",
    "/registro-diario",
    "/ciclos",
    "/cadastros",
    "/relatorios",
    "/auditoria",
    "/tv",
    "/kanban",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("This page didn't load")).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Nova proposta", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PROPOSTA", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("cria proposta, move, registra análise e comentário, cancela e recupera o mesmo card", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/kanban");
  await page.getByRole("button", { name: "Nova proposta", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Unidade", { exact: true })
    .selectOption("70000000-0000-4000-8000-000000000001");
  await modal.getByLabel("Consultor responsável", { exact: true }).selectOption("consultant");
  await modal.getByLabel("Origem do lead / Canal", { exact: true }).selectOption("channel");
  await modal.getByLabel("Código do imóvel", { exact: true }).fill("18592");
  await modal.getByLabel("Valor da Proposta", { exact: true }).fill("3000");
  await modal.getByLabel("% de intermediação", { exact: true }).fill("50");
  await modal.getByRole("button", { name: "Pessoas", exact: true }).click();
  await modal.getByLabel("Nome completo", { exact: true }).fill("Cliente de teste E2E");
  await modal.getByLabel("CPF", { exact: true }).fill("52998224725");
  await modal.getByRole("button", { name: "Enviar proposta", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Cliente de teste E2E", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Etapa atual", { exact: true }).selectOption("fechamento_enviado");
  await page.getByRole("button", { name: "Confirmar movimento", exact: true }).click();
  await expect(page.getByLabel("Etapa atual", { exact: true })).toHaveValue("fechamento_enviado");
  await page.screenshot({ path: "artifacts/card-detail.png", fullPage: true });
  await page.getByLabel("Novo comentário").fill("Decisão operacional registrada");
  await page.getByRole("button", { name: "Comentar", exact: true }).click();
  await expect(page.getByText("Decisão operacional registrada", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Análise", exact: true }).click();
  await page
    .getByLabel("Pendência de documentação / Aprovação da Direção", { exact: true })
    .fill("Análise documental registrada");
  await page.getByRole("button", { name: "Salvar análise", exact: true }).click();
  await page.getByLabel("Etapa atual", { exact: true }).selectOption("cancelado");
  await page
    .getByRole("dialog")
    .last()
    .getByLabel("Motivo", { exact: true })
    .selectOption("reason");
  await page
    .getByRole("dialog")
    .last()
    .getByLabel("Explicação / parecer", { exact: true })
    .fill("Solicitação de ajuste da garantia");
  await page.getByRole("button", { name: "Confirmar movimento", exact: true }).click();
  await page.getByRole("button", { name: "Recuperar processo", exact: true }).click();
  await page.getByLabel("O que mudou na recuperação?", { exact: true }).fill("Garantia ajustada");
  await page
    .getByRole("button", { name: "Recuperar para Fechamento Enviado", exact: true })
    .click();
  await expect(page.getByLabel("Etapa atual", { exact: true })).toHaveValue("fechamento_enviado");
  await page.getByRole("button", { name: "Fechar diálogo", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Abrir card de Cliente de teste E2E", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem("adim-platform:v1")!));
  expect(result.cards).toHaveLength(1);
  expect(result.cards[0].recovered).toBe(true);
  expect(
    result.activities.filter((a: { type: string }) => a.type === "milestone.closing"),
  ).toHaveLength(1);
  expect(errors).toEqual([]);
});
test("configura campos, documentos e tarefas sem editor de colunas", async ({ page }) => {
  await page.goto("/kanban");
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adicionar coluna", exact: true })).toHaveCount(0);
  await page.getByLabel("Nome da tarefa", { exact: true }).fill("Conferir proposta");
  await page.getByLabel("SLA em horas", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
  await expect(page.getByLabel("Tarefa", { exact: true })).toHaveValue("Conferir proposta");
  await page.getByRole("button", { name: "Documentos Obrigatórios", exact: true }).click();
  await page.getByLabel("Nome do documento", { exact: true }).fill("Contrato");
  await page.getByLabel("ENTREGA DAS CHAVES", { exact: true }).check();
  await page.getByRole("button", { name: "Adicionar documento", exact: true }).click();
  await expect(page.getByLabel("Nome do documento", { exact: true }).last()).toHaveValue(
    "Contrato",
  );
  await page.getByRole("button", { name: "Campos do Card", exact: true }).click();
  await page.getByLabel("Nome do novo campo", { exact: true }).fill("Detalhe adicional");
  await page.getByRole("button", { name: "Adicionar campo", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("adim-platform:v1")!));
  expect(saved.fields.some((f: { name: string }) => f.name === "Detalhe adicional")).toBe(true);
});
test("mantém navegação e rolagem do Kanban no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kanban");
  await expect(page.getByRole("button", { name: "Nova proposta", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PROPOSTA", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/kanban-mobile.png", fullPage: true });
});

test("persiste registro diário, pré-leads, ciclo e distribuição de metas", async ({ page }) => {
  await page.goto("/registro-diario");
  await page.getByLabel("Data do registro", { exact: true }).fill("2026-09-14");
  await page.getByLabel("Pré leads da empresa (Laís)", { exact: true }).fill("20");
  await page.getByRole("button", { name: /^Equipe Itapema/ }).click();
  for (const [field, value] of [
    ["leads", "10"],
    ["atendimentos", "8"],
    ["agendamentos", "6"],
    ["visitas", "4"],
  ]) {
    await page.getByLabel(`${field} de Consultor E2E`, { exact: true }).fill(value!);
  }
  await page.getByRole("button", { name: "Salvar o dia", exact: true }).click();
  await expect(page.getByText("Registro de 14/09/2026 salvo.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel("Data do registro", { exact: true }).fill("2026-09-14");
  await expect(page.getByLabel("Pré leads da empresa (Laís)", { exact: true })).toHaveValue("20");
  await page.getByRole("button", { name: /^Equipe Itapema/ }).click();
  await expect(page.getByLabel("leads de Consultor E2E", { exact: true })).toHaveValue("10");
  await page.goto("/ciclos");
  await page.getByRole("button", { name: "Novo ciclo", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Nome do ciclo", { exact: true }).fill("Ciclo E2E");
  await modal.getByLabel("Início", { exact: true }).fill("2026-09-01");
  await modal.getByLabel("Fim", { exact: true }).fill("2026-09-30");
  await modal.getByLabel("Meta de VGL (R$)", { exact: true }).fill("12000");
  await modal.getByLabel("Meta de contratos", { exact: true }).fill("4");
  await modal.getByRole("button", { name: "Criar ciclo", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Distribuir metas", exact: true }).click();
  await expect(
    page.getByText("Metas distribuídas. Ajustes individuais podem ser feitos abaixo.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Meta de VGL de Consultor E2E", { exact: true })).toHaveValue(
    "6000",
  );
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem("adim-platform:v1")!));
  expect(result.tables.registros_diarios[0]).toMatchObject({
    leads: 10,
    atendimentos: 8,
    agendamentos: 6,
    visitas: 4,
  });
  expect(result.tables.pre_leads_diarios[0].quantidade).toBe(20);
  expect(result.tables.ciclos[0]).toMatchObject({
    nome: "Ciclo E2E",
    meta_vgl: 12000,
    meta_contratos: 4,
  });
  expect(result.tables.metas).toHaveLength(3);
});
