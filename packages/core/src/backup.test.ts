import { describe, it, expect } from "vitest";
import { backupSchema } from "./backup";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const backup = {
  version: 3, exportedAt: "2026-10-09T00:00:00.000Z",
  workspace: { name: "Personal", baseCurrency: "ARS", country: "AR", timezone: "America/Argentina/Buenos_Aires" },
  ledger: { accounts: [{ id, name: "Banco", currency: "ARS", openingMinor: "0", openingDate: "2026-01-01" }], transactions: [] },
  categories: [{ id, name: "General", group: "Otros" }],
  recurrences: [], installments: [], debts: [], budgets: [], goals: [], cards: [], scenarios: [], rules: [], fxRates: [], alertPreferences: {}, imports: [], transfers: [],
};
describe("respaldo financiero", () => {
  it("rechaza referencias inexistentes antes de restaurar", () => {
    expect(backupSchema.safeParse(backup).success).toBe(true);
    expect(backupSchema.safeParse({ ...backup, rules: [{ id, name: "Regla", contains: "compra", categoryId: other, priority: 1, active: true, type: "expense" }] }).success).toBe(false);
  });
  it("no acepta cotizaciones contradictorias del mismo día", () => {
    const rate = { id, base: "USD", quote: "ARS", rate: "1200", date: "2026-01-01", source: "Manual" };
    expect(backupSchema.safeParse({ ...backup, fxRates: [rate, { ...rate, id: other, base: "ARS", quote: "USD", rate: "0.001" }] }).success).toBe(false);
  });
  it("descarta identidades de usuario y rechaza duplicaciones", () => {
    const parsed = backupSchema.parse({ ...backup, workspace: { ...backup.workspace, ownerId: other }, user: { email: "privado@example.test" } });
    expect(parsed.workspace).not.toHaveProperty("ownerId");
    expect(parsed).not.toHaveProperty("user");
    expect(backupSchema.safeParse({ ...backup, categories: [backup.categories[0], backup.categories[0]] }).success).toBe(false);
  });
});
