import { accountBalance } from "./index";
import { obligations, type Planning } from "./planning";
import type { Ledger } from "./schemas";
export type CreditCardData = {
  accountId: string;
  fundingAccountId: string;
  limitMinor: string;
  closingDay: number;
  dueDay: number;
};
export function cardSummary(
  ledger: Ledger,
  planning: Planning,
  card: CreditCardData,
  today: string,
) {
  const account = ledger.accounts.find((a) => a.id === card.accountId);
  if (!account) throw new Error("Tarjeta inexistente");
  const balance = BigInt(accountBalance(account, ledger.transactions, today));
  const consumed = balance < 0n ? -balance : 0n,
    available = BigInt(card.limitMinor) + balance;
  const events = obligations(
    ledger,
    {
      recurrences: [],
      installments: planning.installments.filter(
        (p) => p.repaymentAccountId === card.accountId,
      ),
    },
    "1900-01-01",
    "2199-12-31",
  );
  const nextDate = events[0]?.date ?? null;
  const next = events
    .filter((e) => e.date === nextDate)
    .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
  const future = events
    .filter((e) => e.date !== nextDate)
    .reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
  return {
    consumed: consumed.toString(),
    available: (available < 0n ? 0n : available).toString(),
    next: next.toString(),
    future: future.toString(),
    nextDate,
    events,
  };
}
