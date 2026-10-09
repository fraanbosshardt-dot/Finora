export const proSections = new Set([
  "Informes",
  "Reglas",
  "Monedas",
  "Tarjetas",
  "Préstamos",
  "Simulador",
  "Simular préstamo",
]);
export const proActions = new Set([
  "rule.save",
  "rule.apply",
  "fx.save",
  "card.create",
  "card.purchase",
  "debt.create",
  "debt.extra",
  "installment.save",
  "scenario.save",
  "ledger.import",
]);
export const pricing = {
  monthly: "3,99",
  yearly: "29,99",
  yearlyMonthly: "2,50",
  currency: "USD",
} as const;
export function activePlan(
  workspace: { plan: string; proUntil: Date | string | null },
  now = Date.now(),
): "FREE" | "PRO" {
  return workspace.plan === "PRO" &&
    workspace.proUntil !== null &&
    new Date(workspace.proUntil).getTime() > now
    ? "PRO"
    : "FREE";
}
