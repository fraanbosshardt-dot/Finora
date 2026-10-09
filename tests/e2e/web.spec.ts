import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTestPlan } from "./test-plan";
import {
  accountBalance,
  netWorth,
  debtSchedule,
  obligations,
  parseCsv,
} from "@finora/core";
const origin = "http://127.0.0.1:3000",
  password = "Finora-test-2026!";
async function createUser(request: APIRequestContext, name = "Test") {
  const email = `finora-${randomUUID()}@example.test`;
  let response = await request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { name, email, password },
  });
  for (let retry = 0; response.status() === 429 && retry < 6; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    response = await request.post("/api/auth/sign-up/email", {
      headers: { origin },
      data: { name, email, password },
    });
  }
  expect(response.ok(), await response.text()).toBe(true);
  return email;
}
async function setup(request: APIRequestContext) {
  await createUser(request);
  const accountId = randomUUID(),
    today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  const response = await request.post("/api/workspaces", {
    headers: { origin },
    data: {
      name: "Espacio test",
      country: "AR",
      currency: "ARS",
      timezone: "America/Argentina/Buenos_Aires",
      account: {
        id: accountId,
        name: "Banco test",
        currency: "ARS",
        openingMinor: "100000",
        openingDate: today,
        kind: "bank",
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const workspaceId = (await response.json()).workspace.id;
  await setTestPlan(workspaceId, "PRO");
  const snapshotResponse = await request.get(
    `/api/workspaces/${workspaceId}/data`,
  );
  expect(snapshotResponse.ok(), await snapshotResponse.text()).toBe(true);
  const snapshot = await snapshotResponse.json();
  return {
    workspaceId,
    accountId,
    today,
    categoryId: snapshot.categories.find(
      (c: { name: string }) => c.name === "Supermercado",
    ).id,
    snapshot,
  };
}
async function cleanup(request: APIRequestContext) {
  await request.post("/api/auth/delete-user", {
    headers: { origin },
    data: { password },
  });
}

test("revocar sesión y recuperar contraseña invalida sesiones anteriores", async ({
  request,
  playwright,
}) => {
  const email = await createUser(request);
  const other = await playwright.request.newContext({ baseURL: origin });
  let reset = false;
  const newPassword = "Finora-renovada-2026!";
  try {
    expect(
      (
        await other.post("/api/auth/sign-in/email", {
          headers: { origin },
          data: { email, password },
        })
      ).ok(),
    ).toBe(true);
    const otherSession = await (
      await other.get("/api/auth/get-session")
    ).json();
    expect(
      (
        await request.post("/api/auth/revoke-session", {
          headers: { origin },
          data: { token: otherSession.session.token },
        })
      ).ok(),
    ).toBe(true);
    expect(await (await other.get("/api/auth/get-session")).json()).toBeNull();
    const recovery = await request.post("/api/auth/request-password-reset", {
      headers: { origin },
      data: { email, redirectTo: `${origin}/restablecer` },
    });
    expect(recovery.ok(), await recovery.text()).toBe(true);
    let url = "";
    await expect
      .poll(async () => {
        const directory = resolve(".local/mail");
        for (const file of await readdir(directory)) {
          const mail = JSON.parse(
            await readFile(resolve(directory, file), "utf8"),
          );
          if (mail.to === email && mail.subject === "Recuperá tu contraseña")
            url = mail.url;
        }
        return Boolean(url);
      })
      .toBe(true);
    const token = new URL(url).pathname.split("/").at(-1)!;
    const response = await request.post("/api/auth/reset-password", {
      headers: { origin },
      data: { token, newPassword },
    });
    expect(response.ok(), await response.text()).toBe(true);
    reset = true;
    expect(
      await (await request.get("/api/auth/get-session")).json(),
    ).toBeNull();
    expect(
      (
        await request.post("/api/auth/sign-in/email", {
          headers: { origin },
          data: { email, password: newPassword },
        })
      ).ok(),
    ).toBe(true);
  } finally {
    if (reset)
      await request.post("/api/auth/delete-user", {
        headers: { origin },
        data: { password: newPassword },
      });
    else await cleanup(request);
    await other.dispose();
  }
});

test("informes filtran monedas y cuentas y exportan importes exactos", async ({
  page,
}) => {
  const { workspaceId, accountId, today, categoryId } = await setup(
    page.request,
  );
  async function act(data: unknown) {
    const response = await page.request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data },
    );
    expect(response.ok(), await response.text()).toBe(true);
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await act({
      action: "transaction.save",
      data: {
        id: randomUUID(),
        accountId,
        categoryId,
        category: "Supermercado",
        type: "income",
        amountMinor: "50000",
        description: "Ingreso informe",
        date: today,
      },
    });
    await act({
      action: "transaction.save",
      data: {
        id: randomUUID(),
        accountId,
        categoryId,
        category: "Supermercado",
        type: "expense",
        amountMinor: "12525",
        description: "Gasto informe",
        date: today,
      },
    });
    const usd = randomUUID();
    await act({
      action: "account.save",
      data: {
        id: usd,
        name: "Cuenta USD informe",
        currency: "USD",
        openingMinor: "0",
        openingDate: today,
        kind: "cash",
        liquid: true,
      },
    });
    await act({
      action: "transaction.save",
      data: {
        id: randomUUID(),
        accountId: usd,
        categoryId,
        category: "Supermercado",
        type: "expense",
        amountMinor: "999",
        description: "Gasto USD",
        date: today,
      },
    });
    await page.goto("/app?tab=Informes");
    const totals = page.getByRole("region", { name: "Totales del informe" });
    await expect(totals.getByText("$ 500,00", { exact: true })).toBeVisible();
    await expect(totals.getByText("$ 125,25", { exact: true })).toBeVisible();
    await expect(totals.getByText("$ 374,75", { exact: true })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar informe CSV" }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toContain("ARS");
    const csv = parseCsv(await readFile((await file.path())!, "utf8"));
    expect(csv.rows).toHaveLength(2);
    expect(csv.rows.map((row) => row[2]).sort()).toEqual(["125,25", "500,00"]);
    await page.getByLabel("Cuenta del informe").selectOption(accountId);
    await expect(totals.getByText("$ 374,75", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/reports-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "test-results/reports-desktop.png",
      fullPage: true,
    });
    await page.getByLabel("Ver moneda").selectOption("USD");
    await expect(totals.getByText("US$ 9,99", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Movimientos", exact: true })
      .click();
    await page.locator("#filterAccount").selectOption(usd);
    await expect(page.getByText("Gasto USD", { exact: true })).toBeVisible();
    await expect(page.getByText("Gasto informe", { exact: true })).toHaveCount(
      0,
    );
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});
test("registro, onboarding y flujo financiero completo en web y 360px", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/registro");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba Web");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`web-${randomUUID()}@example.test`);
  await page.getByLabel("Contraseña").fill(password);
  await page
    .getByRole("button", { name: "Crear mi cuenta", exact: true })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByLabel("Nombre de tu primera cuenta").fill("Banco principal");
  await page.getByLabel("Saldo inicial", { exact: true }).fill("1000,29");
  await page.screenshot({
    path: "test-results/design-onboarding-account.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.screenshot({
    path: "test-results/design-onboarding-confirm.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Empezar a organizarme" }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".balance-card strong")).toHaveText("$ 1.000,29");
  const memberships = await (await page.request.get("/api/workspaces")).json();
  await setTestPlan(memberships.workspaces[0].id, "PRO");
  await page.reload();
  await expect(page.locator(".balance-card strong")).toHaveText("$ 1.000,29");
  try {
    await page
      .getByRole("button", { name: "+ Registrar movimiento", exact: true })
      .click();
    await page.getByLabel("Importe", { exact: true }).fill("200,10");
    await page.getByLabel("Descripción", { exact: true }).fill("Supermercado");
    await page.getByLabel("Buscar categoría").fill("Supermercado");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".balance-card strong")).toHaveText("$ 800,19");
    await page
      .getByRole("button", { name: "+ Registrar movimiento", exact: true })
      .click();
    await page.getByLabel("Tipo de movimiento").selectOption("income");
    await page.getByLabel("Importe", { exact: true }).fill("500");
    await page.getByLabel("Descripción", { exact: true }).fill("Sueldo");
    await page.getByLabel("Buscar categoría").fill("Sueldo");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.locator(".balance-card strong")).toHaveText("$ 1.300,19");
    await page
      .getByRole("button", { name: "Planificación", exact: true })
      .click();
    await page.getByRole("button", { name: "+ Recurrente" }).click();
    await page.getByLabel("Importe", { exact: true }).fill("100");
    await page.getByLabel("Descripción", { exact: true }).fill("Alquiler test");
    await page.getByLabel("Buscar categoría").fill("Alquiler");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("Alquiler test", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Inicio", exact: true }).click();
    await expect(page.locator(".balance-card strong")).toHaveText("$ 1.200,19");
    await page.getByRole("button", { name: "Simulador", exact: true }).click();
    await page.getByLabel("¿Qué querés comprar?").fill("Viaje test");
    await page.getByLabel("Precio total en ARS").fill("2000");
    await page.getByRole("button", { name: "Calcular impacto" }).click();
    await expect(
      page.getByText("Atención: aparecen meses con saldo negativo."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Guardar escenario" }).click();
    await expect(
      page.locator(".account-row").getByText("Viaje test", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(page.getByText("Buscar entre 200 categorías")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar datos JSON" }).click();
    expect((await download).suggestedFilename()).toMatch(/^finora-/);
    await page.getByRole("button", { name: "Inicio", exact: true }).click();
    await page.reload();
    await expect(page.locator(".balance-card strong")).toHaveText("$ 1.200,19");
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/workspace-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "test-results/workspace-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});
test("API aislada por workspace, CSRF, reintentos y transferencias con comisión", async ({
  request,
  playwright,
}) => {
  const { workspaceId, accountId, today, categoryId } = await setup(request);
  const outsider = await playwright.request.newContext({ baseURL: origin });
  await createUser(outsider, "Otro usuario");
  try {
    expect(
      (await outsider.get(`/api/workspaces/${workspaceId}/data`)).status(),
    ).toBe(404);
    const command = {
      action: "transaction.save",
      data: {
        id: randomUUID(),
        accountId,
        categoryId,
        category: "Supermercado",
        type: "expense",
        amountMinor: "101",
        description: "Centavos exactos",
        date: today,
      },
    };
    expect(
      (
        await outsider.post(`/api/workspaces/${workspaceId}/actions`, {
          headers: { origin, "idempotency-key": randomUUID() },
          data: command,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post(`/api/workspaces/${workspaceId}/actions`, {
          headers: {
            origin: "https://evil.example",
            "idempotency-key": randomUUID(),
          },
          data: command,
        })
      ).status(),
    ).toBe(403);
    const key = randomUUID();
    for (let i = 0; i < 2; i++) {
      const response = await request.post(
        `/api/workspaces/${workspaceId}/actions`,
        { headers: { origin, "idempotency-key": key }, data: command },
      );
      expect(response.ok(), await response.text()).toBe(true);
    }
    let snapshot = await (
      await request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(snapshot.ledger.transactions).toHaveLength(1);
    const toId = randomUUID();
    const account = {
      action: "account.save",
      data: {
        id: toId,
        name: "USD test",
        currency: "USD",
        openingMinor: "0",
        openingDate: today,
        kind: "cash",
        liquid: true,
      },
    };
    expect(
      (
        await request.post(`/api/workspaces/${workspaceId}/actions`, {
          headers: { origin, "idempotency-key": randomUUID() },
          data: account,
        })
      ).ok(),
    ).toBe(true);
    const transfer = {
      action: "transfer.create",
      data: {
        id: randomUUID(),
        fromId: accountId,
        toId,
        amountMinor: "12000",
        receivedMinor: "1000",
        feeMinor: "100",
        date: today,
        description: "Cambio manual",
        fxSource: "Manual test",
      },
    };
    const response = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: transfer },
    );
    expect(response.ok(), await response.text()).toBe(true);
    snapshot = await response.json();
    expect(
      snapshot.ledger.transactions.filter(
        (t: { transferId?: string }) => t.transferId,
      ),
    ).toHaveLength(3);
    expect(
      snapshot.ledger.transactions.find(
        (t: { type: string }) => t.type === "transferIn",
      ).amountMinor,
    ).toBe("1000");
    const invalid = {
      ...command,
      data: { ...command.data, id: randomUUID(), amountMinor: "NaN" },
    };
    expect(
      (
        await request.post(`/api/workspaces/${workspaceId}/actions`, {
          headers: { origin, "idempotency-key": randomUUID() },
          data: invalid,
        })
      ).status(),
    ).toBe(400);
  } finally {
    await cleanup(request);
    await cleanup(outsider);
    await outsider.dispose();
  }
});
test("cuotas cruzan el año y confirmación no duplica compromisos", async ({
  request,
}) => {
  const { workspaceId, accountId, today, categoryId } = await setup(request);
  try {
    const data = {
      id: randomUUID(),
      accountId,
      categoryId,
      description: "Celular test",
      totalMinor: "10001",
      downPaymentMinor: "1000",
      purchaseDate: today,
      firstDate: today,
      count: 3,
      active: true,
    };
    const response = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      {
        headers: { origin, "idempotency-key": randomUUID() },
        data: { action: "installment.save", data },
      },
    );
    expect(response.ok(), await response.text()).toBe(true);
    const command = {
        action: "obligation.post",
        key: `installment:${data.id}:down`,
        date: today,
      },
      key = randomUUID();
    for (let i = 0; i < 2; i++) {
      const posted = await request.post(
        `/api/workspaces/${workspaceId}/actions`,
        { headers: { origin, "idempotency-key": key }, data: command },
      );
      expect(posted.ok(), await posted.text()).toBe(true);
    }
    const snapshot = await (
      await request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(snapshot.ledger.transactions).toHaveLength(1);
    expect(snapshot.ledger.transactions[0].amountMinor).toBe("1000");
    const duplicate = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: command },
    );
    expect(duplicate.status()).toBe(409);
  } finally {
    await cleanup(request);
  }
});
test("landing responsive y calculadora pública", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Sabé cuánto podés gastar",
  );
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  await page.goto("/calculadora-cuotas");
  await page.getByLabel("Precio total en ARS, incluidos cargos").fill("100,01");
  await page.getByLabel("Cuotas", { exact: true }).fill("3");
  await page.getByLabel("Primera fecha").fill("2026-12-31");
  await page.getByRole("button", { name: "Calcular cronograma" }).click();
  await expect(page.getByText("2027-02-28")).toBeVisible();
  await expect(page.getByText("$ 33,34")).toHaveCount(2);
});

test("CSV con vista previa, aplicar simulación y tarjeta en 360px", async ({
  page,
}) => {
  const { today } = await setup(page.request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  try {
    await page.goto("/app?tab=Ajustes");
    await page.getByLabel("Archivo CSV").setInputFiles({
      name: "movimientos.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `fecha;descripcion;importe;tipo\n${today};Importado desde CSV;12,34;gasto\n`,
      ),
    });
    await page.getByRole("button", { name: "Revisar 1 movimientos" }).click();
    await expect(page.getByText("Vista previa: 1 movimientos")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "$ 12,34", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar importación CSV" })
      .click();
    await expect(page.getByText("1 movimientos importados")).toBeVisible();
    await page.getByRole("button", { name: "Deshacer lote" }).click();
    await expect(page.getByText("Revertida", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Simulador", exact: true }).click();
    await page.getByLabel("¿Qué querés comprar?").fill("Compra aplicada");
    await page.getByLabel("Precio total en ARS").fill("100,01");
    await page.getByLabel("Pagos", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Calcular impacto" }).click();
    await page
      .getByLabel("Categoría para la compra")
      .selectOption({ label: "Supermercado" });
    await page.getByRole("button", { name: "Aplicar a planificación" }).click();
    await page
      .getByRole("button", { name: "Planificación", exact: true })
      .click();
    await expect(
      page.getByText("Compra aplicada", { exact: true }).first(),
    ).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("button", { name: "Tarjetas", exact: true }).click();
    await page.getByRole("button", { name: "+ Agregar tarjeta" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Visa navegador");
    await page.getByLabel("Límite total").fill("1000");
    await page
      .getByRole("button", { name: "Guardar operación", exact: true })
      .click();
    await expect(
      page.getByText("Visa navegador", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/cards-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Préstamos", exact: true }).click();
    await page.getByRole("button", { name: "+ Agregar préstamo" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/loan-form-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});

test("tarjetas y préstamos mantienen patrimonio y pagos sin doble gasto", async ({
  request,
}) => {
  const { workspaceId, accountId, today, categoryId } = await setup(request);
  async function act(data: unknown) {
    const response = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  try {
    const cardId = randomUUID();
    await act({
      action: "card.create",
      data: {
        id: cardId,
        name: "Visa test",
        fundingAccountId: accountId,
        limitMinor: "100000",
        openingDebtMinor: "1000",
        openingDate: today,
        firstDueDate: today,
        closingDay: 20,
        dueDay: 10,
      },
    });
    let snapshot = await (
      await request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(netWorth(snapshot.ledger, snapshot.debts, "ARS", today)).toBe(
      "99000",
    );
    const initial = obligations(snapshot.ledger, snapshot, today, today)[0]!;
    snapshot = await act({
      action: "obligation.post",
      key: initial.key,
      date: today,
    });
    expect(
      accountBalance(
        snapshot.ledger.accounts.find((a: { id: string }) => a.id === cardId),
        snapshot.ledger.transactions,
        today,
      ),
    ).toBe("0");
    expect(netWorth(snapshot.ledger, snapshot.debts, "ARS", today)).toBe(
      "99000",
    );
    expect(
      snapshot.ledger.transactions.filter(
        (t: { type: string }) => t.type === "expense",
      ),
    ).toHaveLength(0);
    snapshot = await act({
      action: "card.purchase",
      data: {
        id: randomUUID(),
        cardId,
        categoryId,
        description: "Notebook",
        totalMinor: "10001",
        count: 3,
        date: today,
      },
    });
    expect(
      accountBalance(
        snapshot.ledger.accounts.find((a: { id: string }) => a.id === cardId),
        snapshot.ledger.transactions,
        today,
      ),
    ).toBe("-10001");
    expect(
      snapshot.ledger.transactions.filter(
        (t: { type: string }) => t.type === "expense",
      ),
    ).toHaveLength(1);
    const debtId = randomUUID();
    snapshot = await act({
      action: "debt.create",
      data: {
        id: debtId,
        accountId,
        categoryId,
        name: "Préstamo",
        principalMinor: "30000",
        receivedMinor: "30000",
        chargesMinor: "0",
        monthlyRate: "0",
        system: "german",
        count: 3,
        disbursementDate: today,
        firstDate: today,
        active: true,
      },
    });
    expect(netWorth(snapshot.ledger, snapshot.debts, "ARS", today)).toBe(
      "88999",
    );
    const row = debtSchedule(snapshot.debts[0])[0]!;
    snapshot = await act({
      action: "obligation.post",
      key: row.key,
      date: today,
    });
    expect(netWorth(snapshot.ledger, snapshot.debts, "ARS", today)).toBe(
      "88999",
    );
    snapshot = await act({
      action: "debt.extra",
      id: debtId,
      amountMinor: "5000",
      date: today,
    });
    expect(netWorth(snapshot.ledger, snapshot.debts, "ARS", today)).toBe(
      "88999",
    );
    expect(debtSchedule(snapshot.debts[0]).at(-1)?.balanceMinor).toBe("0");
  } finally {
    await cleanup(request);
  }
});

test("importación atómica, deduplicación, reversión, presupuestos y objetivos", async ({
  request,
}) => {
  const {
    workspaceId,
    accountId,
    today,
    categoryId,
    snapshot: initial,
  } = await setup(request);
  async function act(data: unknown) {
    const response = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  try {
    const data = {
      accounts: initial.ledger.accounts,
      transactions: [
        {
          id: randomUUID(),
          accountId,
          category: "Supermercado",
          type: "expense",
          amountMinor: "999",
          description: "Importación test",
          date: today,
        },
      ],
    };
    let snapshot = await act({ action: "ledger.import", data });
    const batch = snapshot.imports.find(
      (i: { importedCount: number }) => i.importedCount === 1,
    );
    expect(snapshot.ledger.transactions).toHaveLength(1);
    snapshot = await act({ action: "ledger.import", data });
    expect(snapshot.ledger.transactions).toHaveLength(1);
    snapshot = await act({ action: "import.rollback", id: batch.id });
    expect(snapshot.ledger.transactions).toHaveLength(0);
    expect(snapshot.ledger.accounts).toHaveLength(1);
    const budgetId = randomUUID(),
      goalId = randomUUID();
    await act({
      action: "budget.save",
      data: {
        id: budgetId,
        categoryId,
        currency: "ARS",
        month: today.slice(0, 7),
        amountMinor: "10000",
      },
    });
    snapshot = await act({
      action: "goal.save",
      data: {
        id: goalId,
        name: "Emergencia",
        currency: "ARS",
        targetMinor: "100000",
        savedMinor: "1000",
        targetDate: today,
      },
    });
    expect(snapshot.budgets).toHaveLength(1);
    expect(snapshot.goals).toHaveLength(1);
    await act({ action: "budget.delete", id: budgetId });
    snapshot = await act({ action: "goal.delete", id: goalId });
    expect(snapshot.budgets).toHaveLength(0);
    expect(snapshot.goals).toHaveLength(0);
    const invalid = await request.post(
      `/api/workspaces/${workspaceId}/actions`,
      {
        headers: { origin, "idempotency-key": randomUUID() },
        data: {
          action: "transfer.create",
          data: {
            id: randomUUID(),
            fromId: accountId,
            toId: randomUUID(),
            amountMinor: "1",
            receivedMinor: "1",
            feeMinor: "NaN",
            date: today,
            description: "Inválido",
            fxSource: "Manual",
          },
        },
      },
    );
    expect(invalid.status()).toBe(400);
  } finally {
    await cleanup(request);
  }
});

test("presupuestos editables, calendario por período y perfil seguro", async ({
  page,
}) => {
  const { workspaceId, categoryId, today } = await setup(page.request);
  const budgetId = randomUUID();
  const endpoint = `/api/workspaces/${workspaceId}/actions`;
  try {
    const response = await page.request.post(endpoint, {
      headers: { origin, "Idempotency-Key": randomUUID() },
      data: {
        action: "budget.save",
        data: {
          id: budgetId,
          categoryId,
          month: today.slice(0, 7),
          currency: "ARS",
          amountMinor: "12345",
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await page.goto("/app?tab=Presupuestos");
    await page.getByRole("button", { name: "Editar presupuesto" }).click();
    await expect(page.getByLabel("Límite mensual")).toHaveValue("123,45");
    await page.getByLabel("Límite mensual").fill("678,90");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByText("$ 678,90", { exact: false }).first(),
    ).toBeVisible();
    const snapshot = await (
      await page.request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(snapshot.budgets).toHaveLength(1);
    expect(snapshot.budgets[0].id).toBe(budgetId);
    expect(snapshot.budgets[0].amountMinor).toBe("67890");
    await page.goto("/app?tab=Planificación");
    await page.getByLabel("Vista", { exact: true }).selectOption("week");
    await expect(page.getByLabel("Inicio de la semana")).toBeVisible();
    await page.getByLabel("Vista", { exact: true }).selectOption("day");
    await expect(page.getByLabel("Día", { exact: true })).toHaveValue(today);
    expect(
      await page
        .locator(".sidebar")
        .evaluate((element) => getComputedStyle(element).scrollbarWidth),
    ).toBe("none");
    await page.goto("/app?tab=Ajustes");
    await page
      .getByLabel("Tu nombre", { exact: true })
      .fill("Perfil actualizado");
    await page.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(
      page.getByRole("heading", { name: "Perfil actualizado", exact: true }),
    ).toBeVisible();
    await page.getByText("Cambiar contraseña", { exact: true }).click();
    await page.getByLabel("Contraseña actual", { exact: true }).fill(password);
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill(password + "Nueva");
    await page
      .getByLabel("Repetir nueva contraseña", { exact: true })
      .fill(password + "Nueva");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(
      page.getByText("Contraseña actualizada. Se cerraron las demás sesiones."),
    ).toBeVisible();
    await page.request.post("/api/auth/change-password", {
      headers: { origin },
      data: {
        currentPassword: password + "Nueva",
        newPassword: password,
        revokeOtherSessions: true,
      },
    });
  } finally {
    await cleanup(page.request);
  }
});

test("editar recurrente conserva pagos y exporta calendario sin conexión", async ({
  page,
}) => {
  const { workspaceId, accountId, categoryId, today } = await setup(
    page.request,
  );
  const id = randomUUID();
  const recurrence = {
    id,
    accountId,
    categoryId,
    description: "Suscripción editable",
    type: "expense",
    amountMinor: "1234",
    startDate: today,
    endDate: null,
    frequency: "monthly",
    interval: 1,
    active: true,
  };
  async function action(data: unknown) {
    return page.request.post(`/api/workspaces/${workspaceId}/actions`, {
      headers: { origin, "Idempotency-Key": randomUUID() },
      data,
    });
  }
  try {
    expect(
      (await action({ action: "recurrence.save", data: recurrence })).ok(),
    ).toBe(true);
    expect(
      (
        await action({
          action: "obligation.post",
          key: `recurrence:${id}:${today}`,
          date: today,
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/app?tab=Planificación");
    await page.getByRole("button", { name: "Editar recurrente" }).click();
    await expect(page.getByLabel("Importe", { exact: true })).toHaveValue(
      "12,34",
    );
    await page.getByLabel("Importe", { exact: true }).fill("56,78");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByText("$ 56,78", { exact: false }).first(),
    ).toBeVisible();
    const snapshot = await (
      await page.request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(snapshot.recurrences).toHaveLength(1);
    expect(snapshot.recurrences[0].amountMinor).toBe("5678");
    expect(snapshot.ledger.transactions[0].amountMinor).toBe("1234");
    expect(
      (
        await action({
          action: "recurrence.save",
          data: { ...recurrence, interval: 2 },
        })
      ).status(),
    ).toBe(400);
    await page.getByRole("button", { name: "Mes siguiente" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar calendario ICS" })
      .click();
    const file = await downloadPromise;
    const contents = await readFile((await file.path())!, "utf8");
    expect(contents).toContain("BEGIN:VCALENDAR");
    expect(contents).toContain("Suscripción editable");
    expect(contents).toContain("56\\,78");
    await page.goto("/app?tab=Consultas");
    await page
      .getByLabel("Tu consulta", { exact: true })
      .fill("¿Cuánto tengo comprometido?");
    await page.getByRole("button", { name: "Consultar mis registros" }).click();
    await expect(page.locator(".local-answer")).toContainText(
      "Tus pagos pendientes",
    );
    await page
      .getByLabel("Tu consulta", { exact: true })
      .fill("Comprame acciones");
    await page.getByRole("button", { name: "Consultar mis registros" }).click();
    await expect(
      page.getByText("Todavía puedo responder", { exact: false }),
    ).toBeVisible();
  } finally {
    await cleanup(page.request);
  }
});

test("gasto futuro único y todas las áreas ordenadas en escritorio y 360px", async ({
  page,
}) => {
  const { workspaceId, today } = await setup(page.request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const views = [
    "Consultas",
    "Movimientos",
    "Informes",
    "Alertas",
    "Reglas",
    "Cuentas",
    "Monedas",
    "Tarjetas",
    "Préstamos",
    "Planificación",
    "Presupuestos",
    "Objetivos",
    "Simulador",
    "Simular préstamo",
    "Ajustes",
  ];
  try {
    await page.goto("/app?tab=Planificación");
    await page
      .getByRole("button", { name: "+ Gasto futuro", exact: true })
      .first()
      .click();
    await page.getByLabel("Importe", { exact: true }).fill("123,45");
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Gasto futuro único");
    const future = new Date(`${today}T12:00:00Z`);
    future.setUTCDate(future.getUTCDate() + 2);
    const date = future.toISOString().slice(0, 10);
    await page.getByLabel("Fecha prevista del gasto").fill(date);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByText("Gasto futuro único", { exact: true }).first(),
    ).toBeVisible();
    const snapshot = await (
      await page.request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(snapshot.ledger.transactions).toHaveLength(0);
    expect(snapshot.recurrences[0].startDate).toBe(date);
    expect(snapshot.recurrences[0].endDate).toBe(date);
    expect(
      obligations(snapshot.ledger, snapshot, date, "2027-12-31"),
    ).toHaveLength(1);
    for (const view of views) {
      await page
        .locator(".sidebar")
        .getByRole("button", { name: view, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: view, exact: true, level: 1 }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        view,
      ).toBe(true);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    for (const view of views) {
      await page.goto(`/app?tab=${encodeURIComponent(view)}`);
      await expect(
        page.getByRole("heading", { name: view, exact: true, level: 1 }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        view,
      ).toBe(true);
      if (["Planificación", "Ajustes", "Consultas"].includes(view))
        await page.screenshot({
          path: `C:/Users/franc/.codex/visualizations/2026/10/09/01a121c6-e2ab-7ea0-baaa-f5280c10efca/audit-${view}.png`,
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page.request);
  }
});

test("Free muestra Pro sin activar cobros, controla servidor y respeta vencimiento", async ({
  page,
}) => {
  const { workspaceId, today } = await setup(page.request);
  try {
    await setTestPlan(workspaceId, "FREE");
    await page.goto("/app?tab=Tarjetas");
    await expect(
      page.getByRole("heading", {
        name: "Más claridad para decisiones más grandes.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("USD 29,99", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mensual · USD 3,99" }).click();
    await page.getByRole("button", { name: "Continuar con el pago" }).click();
    await expect(
      page.getByText("Falta conectar la pasarela", { exact: false }),
    ).toBeVisible();
    const command = {
      action: "fx.save",
      data: {
        id: randomUUID(),
        base: "USD",
        quote: "ARS",
        rate: "1000",
        date: today,
        source: "Prueba",
      },
    };
    const blocked = await page.request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: command },
    );
    expect(blocked.status()).toBe(402);
    await page.goto("/app?tab=Planificación");
    await expect(page.getByLabel("Horizonte")).toHaveValue("3");
    await page.getByRole("button", { name: "+ Compra en cuotas" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Más claridad para decisiones más grandes.",
      }),
    ).toBeVisible();
    const data = await (
      await page.request.get(`/api/workspaces/${workspaceId}/data`)
    ).json();
    expect(data.workspace.plan).toBe("FREE");
    expect(data.fxRates).toHaveLength(0);
    await setTestPlan(workspaceId, "PRO", new Date(Date.now() - 1000));
    const expired = await page.request.post(
      `/api/workspaces/${workspaceId}/actions`,
      { headers: { origin, "idempotency-key": randomUUID() }, data: command },
    );
    expect(expired.status()).toBe(402);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app?tab=Simulador");
    await expect(
      page.getByRole("heading", {
        name: "Más claridad para decisiones más grandes.",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "C:/Users/franc/.codex/visualizations/2026/10/09/01a121c6-e2ab-7ea0-baaa-f5280c10efca/pro-mobile.png",
      fullPage: true,
    });
  } finally {
    await cleanup(page.request);
  }
});

test("landing responsive en escritorio, tablet y móvil con animaciones independientes", async ({
  page,
}) => {
  for (const width of [1920, 1280, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `ancho ${width}`,
    ).toBe(true);
    expect(
      await page
        .locator(".dc-preview")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    const overlap = await page.locator(".dc-price-grid").evaluate((element) => {
      const cards = [...element.children].map((card) =>
        card.getBoundingClientRect(),
      );
      return (
        cards.length === 2 &&
        cards[0]!.right > cards[1]!.left &&
        cards[0]!.bottom > cards[1]!.top &&
        cards[1]!.right > cards[0]!.left &&
        cards[1]!.bottom > cards[0]!.top
      );
    });
    expect(overlap, `precios ${width}`).toBe(false);
    if ([1920, 768, 360].includes(width))
      await page.screenshot({
        path: `C:/Users/franc/.codex/visualizations/2026/10/09/01a121c6-e2ab-7ea0-baaa-f5280c10efca/landing-final-${width}.png`,
        fullPage: true,
      });
  }
});

test("planes llevan a registro y Pro conserva intención hasta el pago", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator("#planes").getByRole("link", { name: "Empezar gratis" }),
  ).toHaveAttribute("href", "/registro");
  await page
    .locator("#planes")
    .getByRole("link", { name: "Ver Finora Pro" })
    .click();
  await expect(page).toHaveURL(/registro\?plan=pro/);
  await expect(
    page.getByRole("link", { name: "Iniciar sesión", exact: true }),
  ).toHaveAttribute("href", "/ingresar?plan=pro&period=yearly");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba plan Pro");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`pro-signup-${randomUUID()}@example.test`);
  await page.getByLabel("Contraseña").fill(password);
  await page
    .getByRole("button", { name: "Crear mi cuenta", exact: true })
    .click();
  try {
    await expect(page).toHaveURL(/suscribirse\?period=yearly/, {
      timeout: 20000,
    });
    await expect(
      page.getByText("tu cuenta está creada", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Anual · Ahorrás 37%" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goto("/suscribirse?period=monthly");
    await expect(
      page.getByRole("button", { name: "Mensual · USD 3,99" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("link", { name: "Continuar con Free por ahora" })
      .click();
    await expect(page).toHaveURL(/\/app/);
    await expect(
      page.getByRole("button", { name: "Siguiente", exact: true }),
    ).toBeVisible();
  } finally {
    await cleanup(page.request);
  }
});
