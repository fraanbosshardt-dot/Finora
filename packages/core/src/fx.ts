import { z } from "zod";
import { dateSchema, type Currency, type Ledger } from "./schemas";
import { netWorth, type Debt } from "./debts";
const currency = z.enum(["ARS", "USD", "EUR"]);
export const fxRateSchema = z
  .object({
    id: z.string().uuid(),
    base: currency,
    quote: currency,
    rate: z
      .string()
      .regex(/^\d{1,12}([.,]\d{1,12})?$/)
      .refine((v) => /[1-9]/.test(v), "La cotización debe ser positiva"),
    date: dateSchema,
    source: z.string().trim().min(1).max(80),
  })
  .refine((r) => r.base !== r.quote, "Elegí dos monedas diferentes");
export type FxRate = z.infer<typeof fxRateSchema>;
function units(rate: string) {
  const [whole, fraction = ""] = rate.replace(",", ".").split(".");
  return BigInt(whole!) * 1000000000000n + BigInt(fraction.padEnd(12, "0"));
}
export function convertMoney(
  amountMinor: string,
  base: Currency,
  quote: Currency,
  rates: FxRate[],
  asOf: string,
) {
  if (!/^-?\d{1,24}$/.test(amountMinor)) throw new Error("Importe inválido");
  if (base === quote) return { amountMinor, rate: null };
  const rate = [...rates]
    .filter(
      (r) =>
        r.date <= asOf &&
        ((r.base === base && r.quote === quote) ||
          (r.base === quote && r.quote === base)),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    )[0];
  if (!rate) return null;
  const value = BigInt(amountMinor),
    absolute = value < 0n ? -value : value;
  const numerator = rate.base === base ? units(rate.rate) : 1000000000000n,
    denominator = rate.base === base ? 1000000000000n : units(rate.rate);
  const converted = (absolute * numerator + denominator / 2n) / denominator;
  return {
    amountMinor: ((value < 0n ? -1n : 1n) * converted).toString(),
    rate,
  };
}
export function valuedNetWorth(
  ledger: Ledger,
  debts: Debt[],
  quote: Currency,
  rates: FxRate[],
  asOf: string,
) {
  const currencies = [...new Set(ledger.accounts.map((a) => a.currency))];
  const parts = currencies.map((currency) => {
    const original = netWorth(ledger, debts, currency, asOf);
    const converted =
      BigInt(original) === 0n
        ? { amountMinor: "0", rate: null }
        : convertMoney(original, currency, quote, rates, asOf);
    return { currency, originalMinor: original, converted };
  });
  return {
    parts,
    complete: parts.every((p) => p.converted !== null),
    totalMinor: parts
      .reduce((s, p) => s + BigInt(p.converted?.amountMinor ?? "0"), 0n)
      .toString(),
  };
}
