import {
  accountBalance,
  formatMoney,
  type Account,
  type Currency,
  netWorth,
} from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
export function AccountsView({
  data,
  currency,
  onEdit,
  onAction,
}: {
  data: Snapshot;
  currency: Currency;
  onEdit: (account?: Account) => void;
  onAction: (command: Command) => void;
}) {
  const accounts = data.ledger.accounts.filter(
    (a) => a.currency === currency && a.kind !== "credit",
  );
  const kinds: Record<string, string> = {
    bank: "Banco",
    cash: "Efectivo",
    wallet: "Billetera",
    investment: "Inversiones",
    other: "Otra",
  };
  return (
    <>
      <section className="account-wealth">
        <span>Patrimonio neto en {currency}</span>
        <strong>
          {formatMoney(
            netWorth(data.ledger, data.debts, currency, data.today),
            currency,
          )}
        </strong>
        <p>Cuentas menos tarjetas y capital pendiente de préstamos.</p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Mis cuentas</h2>
          <button onClick={() => onEdit()}>+ Agregar cuenta</button>
        </div>
        {!accounts.length ? (
          <div className="empty">
            <h3>Tu dinero, en un solo lugar</h3>
            <p>
              Agregá una cuenta en {currency} y empezá a registrar tus
              movimientos.
            </p>
          </div>
        ) : (
          <div className="account-grid">
            {accounts.map((account) => (
              <article
                key={account.id}
                className={`account-tile ${account.active === false ? "inactive" : ""}`}
              >
                <div className="panel-heading">
                  <span className="account-icon" aria-hidden="true">
                    ▤
                  </span>
                  <span className="tag">{kinds[account.kind ?? "bank"]}</span>
                </div>
                <h3>{account.name}</h3>
                <strong className="account-total">
                  {formatMoney(
                    accountBalance(
                      account,
                      data.ledger.transactions,
                      data.today,
                    ),
                    account.currency,
                  )}
                </strong>
                <p className="muted">
                  {account.active === false
                    ? "Inactiva · Histórico conservado"
                    : account.liquid === false
                      ? "Incluida en patrimonio"
                      : "Incluida en liquidez"}
                </p>
                <div className="actions-row">
                  <button
                    className="text-button"
                    onClick={() => onEdit(account)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        account.active === false ||
                        window.confirm(
                          `¿Desactivar ${account.name}? Se conserva todo el histórico.`,
                        )
                      )
                        onAction({
                          action: "account.toggle",
                          id: account.id,
                          active: account.active === false,
                        });
                    }}
                  >
                    {account.active === false ? "Reactivar" : "Desactivar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="panel-foot">
          Cada moneda conserva su saldo. El saldo inicial no se registra como
          ingreso.
        </p>
      </section>
    </>
  );
}
