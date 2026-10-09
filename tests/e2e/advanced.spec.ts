import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { setTestPlan } from "./test-plan";
import {
  addMonths,
  obligations,
  netWorth,
  backupSchema,
  financialSummary,
} from "@finora/core";
const origin = "http://127.0.0.1:3000",
  password = "Finora-advanced-2026!";
async function setup(request: APIRequestContext, opening = "100000") {
  const email = `advanced-${randomUUID()}@example.test`;
  let response = await request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password, name: "Prueba avanzada" },
  });
  for (let n = 0; response.status() === 429 && n < 6; n++) {
    await new Promise((r) => setTimeout(r, 10000));
    response = await request.post("/api/auth/sign-up/email", {
      headers: { origin },
      data: { email, password, name: "Prueba avanzada" },
    });
  }
  expect(response.ok(), await response.text()).toBe(true);
  const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
    accountId = randomUUID();
  response = await request.post("/api/workspaces", {
    headers: { origin },
    data: {
      name: "Espacio avanzado",
      country: "AR",
      currency: "ARS",
      timezone: "America/Argentina/Buenos_Aires",
      account: {
        id: accountId,
        name: "Banco avanzado",
        currency: "ARS",
        openingMinor: opening,
        openingDate: today,
        kind: "bank",
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const workspaceId = (await response.json()).workspace.id;
  await setTestPlan(workspaceId, "PRO");
  response = await request.get(`/api/workspaces/${workspaceId}/data`);
  expect(response.ok(), await response.text()).toBe(true);
  const data = await response.json();
  const categoryId = data.categories.find(
    (c: { name: string }) => c.name === "Supermercado",
  ).id;
  async function act(command: unknown) {
    const response = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: command },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  return { workspaceId, accountId, today, categoryId, data, act };
}
async function cleanup(request: APIRequestContext) {
  const response = await request.post("/api/auth/delete-user", {
    headers: { origin },
    data: { password },
  });
  expect(response.ok(), await response.text()).toBe(true);
}
test("respaldo completo conserva patrimonio, compromisos y pagos sin cruzar usuarios", async ({
  request,
  playwright,
}) => {
  const source = await setup(request),
    targetRequest = await playwright.request.newContext({ baseURL: origin }),
    target = await setup(targetRequest, "0");
  try {
    const r = randomUUID();
    await source.act({
      action: "recurrence.save",
      data: {
        id: r,
        accountId: source.accountId,
        categoryId: source.categoryId,
        description: "Alquiler respaldo",
        type: "expense",
        amountMinor: "1000",
        startDate: source.today,
        frequency: "monthly",
        interval: 1,
        active: true,
      },
    });
    await source.act({
      action: "obligation.post",
      key: `recurrence:${r}:${source.today}`,
      date: source.today,
    });
    const cardId = randomUUID();
    let data = await source.act({
      action: "card.create",
      data: {
        id: cardId,
        name: "Tarjeta respaldo",
        fundingAccountId: source.accountId,
        limitMinor: "100000",
        openingDebtMinor: "1000",
        openingDate: source.today,
        firstDueDate: source.today,
        closingDay: 25,
        dueDay: 10,
      },
    });
    const due = obligations(data.ledger, data, source.today, source.today).find(
      (e) => e.repaymentAccountId,
    )!;
    await source.act({
      action: "obligation.post",
      key: due.key,
      date: source.today,
    });
    await source.act({
      action: "card.purchase",
      data: {
        id: randomUUID(),
        cardId,
        categoryId: source.categoryId,
        description: "Compra respaldo",
        totalMinor: "10001",
        count: 3,
        date: source.today,
      },
    });
    const debtId = randomUUID();
    await source.act({
      action: "debt.create",
      data: {
        id: debtId,
        accountId: source.accountId,
        categoryId: source.categoryId,
        name: "Préstamo respaldo",
        principalMinor: "30000",
        receivedMinor: "30000",
        chargesMinor: "10",
        monthlyRate: "2",
        system: "german",
        count: 3,
        disbursementDate: source.today,
        firstDate: addMonths(source.today, 1),
        active: true,
      },
    });
    await source.act({
      action: "debt.extra",
      id: debtId,
      amountMinor: "5000",
      date: source.today,
    });
    await source.act({
      action: "rule.save",
      data: {
        id: randomUUID(),
        name: "Regla respaldo",
        contains: "pan",
        categoryId: source.categoryId,
        accountId: source.accountId,
        type: "expense",
        priority: 0,
        active: true,
      },
    });
    await source.act({
      action: "fx.save",
      data: {
        id: randomUUID(),
        base: "USD",
        quote: "ARS",
        rate: "1200.125",
        source: "Manual respaldo",
        date: source.today,
      },
    });
    await source
      .act({
        action: "ledger.import",
        data: { accounts: [], transactions: [] },
      })
      .catch(() => {});
    const imported = randomUUID();
    await source.act({
      action: "ledger.import",
      data: {
        accounts: source.data.ledger.accounts,
        transactions: [
          {
            id: imported,
            accountId: source.accountId,
            type: "expense",
            category: "Supermercado",
            amountMinor: "111",
            description: "Importado respaldo",
            date: source.today,
          },
        ],
      },
    });
    const backupResponse = await request.get(
      `/api/workspaces/${source.workspaceId}/backup`,
    );
    expect(backupResponse.ok(), await backupResponse.text()).toBe(true);
    const backup = backupSchema.parse(await backupResponse.json());
    expect(
      (
        await targetRequest.get(`/api/workspaces/${source.workspaceId}/backup`)
      ).status(),
    ).toBe(404);
    const rejected = await request.post(
      `/api/workspaces/${source.workspaceId}/backup`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: backup },
    );
    expect(rejected.status()).toBe(409);
    const key = randomUUID();
    let restored: any;
    for (let n = 0; n < 2; n++) {
      const response = await targetRequest.post(
        `/api/workspaces/${target.workspaceId}/backup`,
        { headers: { origin, "idempotency-key": key }, data: backup },
      );
      expect(response.ok(), await response.text()).toBe(true);
      restored = await response.json();
    }
    expect(restored.workspace.id).toBe(target.workspaceId);
    expect(restored.ledger.accounts[0].id).not.toBe(source.accountId);
    expect(restored.ledger.transactions).toHaveLength(
      backup.ledger.transactions.length,
    );
    expect(netWorth(restored.ledger, restored.debts, "ARS", source.today)).toBe(
      netWorth(backup.ledger, backup.debts, "ARS", source.today),
    );
    expect(
      financialSummary(restored.ledger, restored, "ARS", source.today),
    ).toEqual(financialSummary(backup.ledger, backup, "ARS", source.today));
    expect(restored.rules).toHaveLength(1);
    expect(restored.fxRates).toHaveLength(1);
    const batch = restored.imports.find(
      (b: { importedCount: number }) => b.importedCount === 1,
    );
    const after = await target.act({ action: "import.rollback", id: batch.id });
    expect(after.ledger.transactions).toHaveLength(
      restored.ledger.transactions.length - 1,
    );
  } finally {
    await cleanup(request);
    await cleanup(targetRequest);
    await targetRequest.dispose();
  }
});
test("reglas, alertas y cotizaciones autorizadas y con referencias válidas", async ({
  request,
  playwright,
}) => {
  const s = await setup(request),
    outsider = await playwright.request.newContext({ baseURL: origin }),
    other = await setup(outsider);
  try {
    const ruleId = randomUUID();
    await s.act({
      action: "rule.save",
      data: {
        id: ruleId,
        name: "Panadería",
        contains: "panaderia",
        categoryId: s.categoryId,
        type: "expense",
        priority: 0,
        active: true,
      },
    });
    const transactionId = randomUUID();
    await s.act({
      action: "transaction.save",
      data: {
        id: transactionId,
        accountId: s.accountId,
        categoryId: s.data.categories[0].id,
        category: s.data.categories[0].name,
        type: "expense",
        amountMinor: "100",
        description: "Panadería barrio",
        date: s.today,
      },
    });
    const changed = await s.act({ action: "rule.apply", ids: [transactionId] });
    expect(changed.ledger.transactions[0].categoryId).toBe(s.categoryId);
    let response = await outsider.post(
      `/api/workspaces/${s.workspaceId}/actions`,
      {
        headers: { origin, "idempotency-key": randomUUID() },
        data: { action: "rule.delete", id: ruleId },
      },
    );
    expect(response.status()).toBe(404);
    response = await request.post(`/api/workspaces/${s.workspaceId}/actions`, {
      headers: { origin, "idempotency-key": randomUUID() },
      data: {
        action: "rule.save",
        data: {
          id: randomUUID(),
          name: "Ajena",
          contains: "algo",
          categoryId: other.categoryId,
          type: "all",
          priority: 0,
          active: true,
        },
      },
    });
    expect(response.status()).toBe(400);
    const prefs = {
      due: false,
      budget: true,
      negative: false,
      goals: true,
      days: 3,
    };
    const saved = await s.act({ action: "alerts.preferences", data: prefs });
    expect(saved.alertPreferences).toEqual(prefs);
    const dismissed = await s.act({
      action: "alerts.dismiss",
      key: "test:alert",
    });
    expect(dismissed.dismissedAlerts).toContain("test:alert");
    expect(
      (await s.act({ action: "alerts.reset" })).dismissedAlerts,
    ).toHaveLength(0);
    const fxId = randomUUID();
    await s.act({
      action: "fx.save",
      data: {
        id: fxId,
        base: "USD",
        quote: "ARS",
        rate: "1200.25",
        date: s.today,
        source: "Manual",
      },
    });
    expect(
      (await s.act({ action: "fx.delete", id: fxId })).fxRates,
    ).toHaveLength(0);
  } finally {
    await cleanup(request);
    await cleanup(outsider);
    await outsider.dispose();
  }
});
test("calculadora de préstamos pública sin cuenta y con amortización exacta", async ({
  page,
}) => {
  await page.goto("/calculadora-prestamos");
  await page.getByLabel("Capital en ARS").fill("1000");
  await page.getByLabel("Importe recibido").fill("1000");
  await page.getByLabel("Tasa ingresada").fill("0");
  await page.getByLabel("Cantidad de pagos").fill("3");
  await page
    .getByRole("button", { name: "Calcular préstamo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Condiciones calculadas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "$ 333,34", exact: true }),
  ).toHaveCount(4);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/public-loan-mobile.png",
    fullPage: true,
  });
});
test("reglas sugeridas, alertas, simulación de préstamo y proyección ampliada en web", async ({
  page,
}) => {
  const s = await setup(page.request);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto("/app?tab=Reglas");
    await page.getByRole("button", { name: "+ Crear regla" }).click();
    await page.getByLabel("Nombre de regla").fill("Panadería web");
    await page.getByLabel("Descripción contiene").fill("panaderia");
    await page.locator("#rule-category").selectOption(s.categoryId);
    await page
      .getByRole("button", { name: "Guardar regla", exact: true })
      .click();
    await expect(
      page.getByText("Panadería web", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "+ Registrar movimiento", exact: true })
      .click();
    await page.getByLabel("Importe", { exact: true }).fill("12,34");
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Panadería del barrio");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "se guardará en Supermercado" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Simular préstamo", exact: true })
      .click();
    await page.getByLabel("Nombre del préstamo").fill("Crédito web");
    await page.getByLabel("Capital en ARS").fill("1000");
    await page.getByLabel("Importe recibido").fill("1000");
    await page.getByLabel("Tasa ingresada").fill("2");
    await page.getByLabel("Primera fecha de pago").fill(addMonths(s.today, 1));
    await page
      .getByRole("button", { name: "Calcular préstamo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Condiciones calculadas" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Registrar préstamo real" }).click();
    await expect(
      page.getByRole("heading", { name: "Condiciones calculadas" }),
    ).toHaveCount(0);
    await page.getByLabel("Capital a adelantar").fill("100");
    await page
      .getByRole("button", { name: "Simular pago extraordinario" })
      .click();
    await expect(
      page.getByText("Intereses evitados:", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Aplicar pago real" }).click();
    await page
      .getByRole("button", { name: "Planificación", exact: true })
      .click();
    await page.locator("#projection-horizon").selectOption("36");
    await expect(
      page.getByRole("heading", { name: "Proyección a 36 meses" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Monedas", exact: true }).click();
    await page.getByLabel("Unidades destino por 1 origen").fill("1200");
    await page.getByLabel("Fuente o criterio").fill("Manual web");
    await page.getByRole("button", { name: "Guardar cotización" }).click();
    await expect(page.getByText("Manual web", { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/fx-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Alertas", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/alerts-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});

test("diseño importado: ejemplos públicos interactivos y accesibles", async ({
  page,
}) => {
  await page.goto("/");
  const currencies = page.locator("#monedas");
  await currencies.getByRole("button", { name: "USD", exact: true }).click();
  await expect(currencies.locator(".dc-number")).toContainText("US$");
  const loan = page.locator("#calculadora");
  await loan.getByRole("button", { name: "0%", exact: true }).click();
  await expect(loan.getByText("$ 0,00", { exact: true })).toBeVisible();
  await loan.getByRole("button", { name: "24 cuotas", exact: true }).click();
  await expect(
    loan.getByRole("button", { name: "24 cuotas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const purchase = page.locator("#comprar");
  await purchase.getByRole("button", { name: "1 pago", exact: true }).click();
  await expect(purchase.getByRole("status")).toContainText("$ 480.000,00");
  await page
    .locator("#faq")
    .getByText("¿Finora es gratis?", { exact: true })
    .click();
  await expect(page.locator("#faq details").first()).toHaveAttribute(
    "open",
    "",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/design-landing-390.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({
    path: "test-results/design-landing-dark.png",
    fullPage: true,
  });
});

test("diseño móvil: menú de registro, consultas reales y navegación inferior", async ({
  page,
}) => {
  const s = await setup(page.request);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Hola, Prueba",
    );
    const nav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(nav).toBeVisible();
    await page
      .getByRole("button", { name: "Agregar movimiento", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "¿Qué querés registrar?",
    );
    await page.screenshot({ path: "test-results/design-record-sheet.png" });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Ingreso", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Ingreso", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Dígito 1", exact: true }).click();
    await page.getByRole("button", { name: "Dígito 0", exact: true }).click();
    await page.getByRole("button", { name: "Dígito 0", exact: true }).click();
    await expect(page.getByLabel("Importe", { exact: true })).toHaveValue(
      "100",
    );
    await page.screenshot({ path: "test-results/design-quick-record.png" });
    await page
      .getByRole("dialog")
      .getByText("Más opciones", { exact: true })
      .click();
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Ingreso desde menú móvil");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await nav.getByRole("button", { name: "Consultas", exact: true }).click();
    await page
      .getByRole("button", {
        name: "¿Cuánto puedo gastar por día?",
        exact: true,
      })
      .click();
    await expect(page.locator(".local-answer")).toContainText("$ 1.100,00");
    await page.screenshot({
      path: "test-results/design-questions-mobile.png",
      fullPage: true,
    });
    await nav.getByRole("button", { name: "Inicio", exact: true }).click();
    await page.screenshot({
      path: "test-results/design-home-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Agregar movimiento", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Agregar movimiento", exact: true }),
    ).toBeFocused();
    await nav.getByRole("button", { name: "Cuentas", exact: true }).click();
    await expect(page.locator(".account-wealth")).toContainText("$ 1.100,00");
    await page
      .getByRole("button", { name: "Agregar movimiento", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Deuda o crédito", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nuevo préstamo", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Abrir ajustes", exact: true })
      .click();
    const alerts = page.getByRole("switch", {
      name: "Alertas en la aplicación",
      exact: true,
    });
    await expect(alerts).toHaveAttribute("aria-checked", "true");
    await alerts.click();
    await expect(alerts).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await expect(alerts).toHaveAttribute("aria-checked", "false");
    await alerts.click();
    await expect(alerts).toHaveAttribute("aria-checked", "true");
    await page.screenshot({
      path: "test-results/design-settings-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});

test("localhost permite registro, sesión y operaciones y sigue rechazando orígenes ajenos", async ({
  page,
}) => {
  const local = "http://localhost:3000",
    email = `advanced-${randomUUID()}@example.test`;
  await page.goto(`${local}/registro`);
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba localhost");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page
    .getByRole("button", { name: "Crear mi cuenta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Siguiente", exact: true }),
  ).toBeVisible();
  try {
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page
      .getByLabel("Nombre de tu primera cuenta")
      .fill("Banco localhost");
    await page.getByLabel("Saldo inicial", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    const snapshot = page.waitForResponse(
      (r) => r.url().endsWith("/data") && r.ok(),
    );
    await page.getByRole("button", { name: "Empezar a organizarme" }).click();
    const data = await (await snapshot).json();
    await expect(page.locator(".balance-card strong")).toHaveText("$ 100,00");
    const response = await page.request.post(
      `${local}/api/workspaces/${data.workspace.id}/actions`,
      {
        headers: { origin: local, "idempotency-key": randomUUID() },
        data: {
          action: "alerts.preferences",
          data: {
            due: false,
            budget: true,
            negative: true,
            goals: true,
            days: 7,
          },
        },
      },
    );
    expect(response.ok(), await response.text()).toBe(true);
    const denied = await page.request.post(
      `${local}/api/workspaces/${data.workspace.id}/actions`,
      {
        headers: {
          origin: "https://invalid.example",
          "idempotency-key": randomUUID(),
        },
        data: { action: "alerts.reset" },
      },
    );
    expect(denied.status()).toBe(403);
  } finally {
    const response = await page.request.post(`${local}/api/auth/delete-user`, {
      headers: { origin: local },
      data: { password },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});
