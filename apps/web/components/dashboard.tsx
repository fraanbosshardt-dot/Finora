"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarDays,
  ChartPie,
  Target,
  Sparkles,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { type Currency } from "@finora/core";
import type { Snapshot } from "../lib/snapshot";
import type { Command } from "../lib/commands";
import { requestJson } from "../lib/client-api";
import { authClient } from "../lib/auth-client";
import { Brand } from "./brand";
import type { FormKind, EditItem } from "./finance-dialog";
import { Overview } from "./overview";
import { AccountsView } from "./accounts-view";
import { MovementsView } from "./movements-view";
import { PlanningView } from "./planning-view";
import { TargetsView } from "./targets-view";
import { LocalQuestions } from "./local-questions";
import { RecordSheet, type RecordChoice } from "./record-sheet";
import { QuickRecord } from "./quick-record";
import { ProPaywall } from "./pro-paywall";
import { proSections } from "../lib/plans";
const sectionLoading = () => (
  <section className="panel" role="status" aria-busy="true">
    Abriendo sección…
  </section>
);
const FinanceDialog = dynamic(
  () => import("./finance-dialog").then((module) => module.FinanceDialog),
  { loading: sectionLoading },
);
const SimulatorView = dynamic(
  () => import("./simulator-view").then((module) => module.SimulatorView),
  { loading: sectionLoading },
);
const SettingsView = dynamic(
  () => import("./settings-view").then((module) => module.SettingsView),
  { loading: sectionLoading },
);
const CreditView = dynamic(
  () => import("./credit-view").then((module) => module.CreditView),
  { loading: sectionLoading },
);
const ReportsView = dynamic(
  () => import("./reports-view").then((module) => module.ReportsView),
  { loading: sectionLoading },
);
const AutomationView = dynamic(
  () => import("./automation-view").then((module) => module.AutomationView),
  { loading: sectionLoading },
);
const LoanLab = dynamic(
  () => import("./loan-lab").then((module) => module.LoanLab),
  { loading: sectionLoading },
);
const FxView = dynamic(
  () => import("./fx-view").then((module) => module.FxView),
  { loading: sectionLoading },
);
const tabs = [
  { name: "Inicio", icon: LayoutDashboard },
  { name: "Consultas", icon: Sparkles },
  { name: "Movimientos", icon: ArrowLeftRight },
  { name: "Informes", icon: ChartPie },
  { name: "Alertas", icon: CalendarDays },
  { name: "Reglas", icon: Settings },
  { name: "Cuentas", icon: Wallet },
  { name: "Monedas", icon: ArrowLeftRight },
  { name: "Tarjetas", icon: Wallet },
  { name: "Préstamos", icon: Wallet },
  { name: "Planificación", icon: CalendarDays },
  { name: "Presupuestos", icon: ChartPie },
  { name: "Objetivos", icon: Target },
  { name: "Simulador", icon: Sparkles },
  { name: "Simular préstamo", icon: Sparkles },
  { name: "Ajustes", icon: Settings },
];
const navigationGroups = [
  {
    label: "Resumen",
    names: ["Inicio", "Movimientos", "Informes", "Consultas"],
  },
  {
    label: "Tu dinero",
    names: ["Cuentas", "Tarjetas", "Préstamos", "Monedas"],
  },
  {
    label: "Organización",
    names: ["Planificación", "Presupuestos", "Objetivos", "Alertas", "Reglas"],
  },
  { label: "Decisiones", names: ["Simulador", "Simular préstamo"] },
  { label: "Tu cuenta", names: ["Ajustes"] },
];
export function Dashboard({
  workspaceId,
  user,
}: {
  workspaceId: string;
  user: { name: string; email: string };
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [upgradeFeature, setUpgradeFeature] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [currency, setCurrency] = useState<Currency>("ARS"),
    [view, setView] = useState("Inicio"),
    [recordOpen, setRecordOpen] = useState(false),
    [quickType, setQuickType] = useState<"expense" | "income" | null>(null),
    [newTransactionId, setNewTransactionId] = useState<string>(),
    [creditMode, setCreditMode] = useState<"debt" | null>(null),
    [simulatorSeen, setSimulatorSeen] = useState(false),
    [dialog, setDialog] = useState<{
      kind: FormKind;
      edit?: EditItem;
      initialType?: "income" | "expense";
    } | null>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await requestJson<Snapshot>(
        `/api/workspaces/${workspaceId}/data`,
      );
      setData(next);
      setCurrency(next.workspace.baseCurrency as Currency);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos leer tu espacio.",
      );
    }
  }, [workspaceId]);
  const retryKeys = useRef(new Map<string, string>());
  const writing = useRef(false);
  useEffect(() => {
    load();
    setSimulatorSeen(
      localStorage.getItem(`finora:${workspaceId}:simulator-seen`) === "yes",
    );
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some((t) => t.name === tab)) setView(tab!);
  }, [load]);
  function changeView(next: string) {
    setUpgradeFeature(null);
    setView(next);
    setCreditMode(null);
    if (next === "Simulador") {
      setSimulatorSeen(true);
      localStorage.setItem(`finora:${workspaceId}:simulator-seen`, "yes");
    }
    setNotice("");
    setError("");
    history.replaceState(null, "", `/app?tab=${encodeURIComponent(next)}`);
  }
  const action = useCallback(
    async (command: Command) => {
      if (writing.current)
        throw new Error("Esperá a que termine la operación anterior.");
      setBusy(true);
      writing.current = true;
      setError("");
      const payload = JSON.stringify(command);
      const key = retryKeys.current.get(payload) ?? crypto.randomUUID();
      retryKeys.current.set(payload, key);
      try {
        const next = await requestJson<Snapshot>(
          `/api/workspaces/${workspaceId}/actions`,
          {
            method: "POST",
            headers: { "idempotency-key": key },
            body: payload,
          },
        );
        setData(next);
        setNotice("Cambios guardados.");
        retryKeys.current.delete(payload);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos guardar los cambios.",
        );
        throw cause;
      } finally {
        setBusy(false);
        writing.current = false;
      }
    },
    [workspaceId],
  );
  const runAction = (command: Command) => {
    void action(command).catch(() => {});
  };
  if (!data)
    return (
      <main className="loading" aria-busy={!error}>
        {error ? (
          <>
            <h1>No pudimos abrir tu espacio</h1>
            <p className="error" role="alert">
              {error}
            </p>
            <button onClick={load}>Volver a intentar</button>
          </>
        ) : (
          "Preparando tus finanzas…"
        )}
      </main>
    );
  const open = (kind: FormKind, edit?: EditItem) => {
    if (kind === "installment" && data.workspace.plan !== "PRO") {
      setUpgradeFeature("Compras en cuotas");
      return;
    }
    setDialog({ kind, edit });
    setError("");
  };
  const primaryTabs = [
    "Inicio",
    "Movimientos",
    "Planificación",
    "Cuentas",
    "Consultas",
  ];
  function chooseRecord(choice: RecordChoice) {
    setRecordOpen(false);
    if (choice === "debt") {
      changeView("Préstamos");
      setCreditMode("debt");
    } else if (choice === "income" || choice === "expense")
      setQuickType(choice);
    else open(choice);
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">ESPACIO PERSONAL</div>
        <nav aria-label="Navegación principal">
          {navigationGroups.map((group) => (
            <div className="navigation-group" key={group.label}>
              <p className="navigation-label">{group.label}</p>
              {group.names.map((name) => {
                const tab = tabs.find((item) => item.name === name)!;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.name}
                    className={view === tab.name ? "nav-active" : ""}
                    aria-current={view === tab.name ? "page" : undefined}
                    onClick={() => changeView(tab.name)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    {tab.name}
                    {proSections.has(tab.name) &&
                      data.workspace.plan !== "PRO" && (
                        <span className="nav-pro-tag" aria-hidden="true">
                          PRO
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="badge">TU ESPACIO · {data.workspace.plan}</span>
          <p>
            Decisiones más claras,
            <br />
            un movimiento a la vez.
          </p>
          <button className="secondary" onClick={() => changeView("Ajustes")}>
            Mis datos y privacidad
          </button>
        </div>
      </aside>
      <main className="main">
        <nav className="mobile-tools" aria-label="Más secciones">
          {tabs
            .filter((t) => !primaryTabs.includes(t.name))
            .map(({ name, icon: Icon }) => (
              <button
                key={name}
                aria-current={view === name ? "page" : undefined}
                onClick={() => changeView(name)}
              >
                <Icon size={15} />
                {name}
              </button>
            ))}
        </nav>
        <header className="topbar">
          <span>
            {data.workspace.name} <span className="muted">/ {view}</span>
          </span>
          <div className="user-controls">
            <button
              className="avatar"
              aria-label="Abrir ajustes"
              onClick={() => changeView("Ajustes")}
            >
              {user.name[0]?.toUpperCase()}
            </button>
            <button
              className="text-button"
              aria-label="Cerrar sesión"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign("/");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="intro">
            <div>
              <p className="eyebrow">TU DINERO, CON CLARIDAD</p>
              <h1>
                {view === "Inicio" ? `Hola, ${user.name.split(" ")[0]}` : view}
              </h1>
              <p className="muted">
                {view === "Inicio"
                  ? "Tu presente y lo que viene, en un solo lugar."
                  : view === "Planificación"
                    ? "Los compromisos que conocés, mes a mes."
                    : "Cada decisión empieza por entender tus números."}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                open(view === "Planificación" ? "planned" : "transaction")
              }
            >
              {view === "Planificación"
                ? "+ Gasto futuro"
                : "+ Registrar movimiento"}
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {busy && (
            <p className="muted" role="status">
              Guardando…
            </p>
          )}
          <div className="period">
            <h2>
              {new Intl.DateTimeFormat("es-AR", {
                month: "long",
                year: "numeric",
              }).format(new Date(`${data.today}T12:00:00`))}
            </h2>
            <label htmlFor="displayCurrency">
              Ver moneda
              <select
                id="displayCurrency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {["ARS", "USD", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {upgradeFeature ||
          (proSections.has(view) && data.workspace.plan !== "PRO") ? (
            <ProPaywall
              feature={upgradeFeature ?? view}
              onBack={() => {
                setUpgradeFeature(null);
                changeView("Inicio");
              }}
            />
          ) : (
            <>
              {view === "Inicio" && (
                <Overview
                  data={data}
                  currency={currency}
                  onView={changeView}
                  onRegister={() => setRecordOpen(true)}
                  simulatorSeen={simulatorSeen}
                />
              )}
              {view === "Consultas" && (
                <LocalQuestions
                  data={data}
                  currency={currency}
                  onView={changeView}
                />
              )}
              {view === "Cuentas" && (
                <AccountsView
                  data={data}
                  currency={currency}
                  onEdit={(edit) => open("account", edit)}
                  onAction={runAction}
                />
              )}
              {view === "Movimientos" && (
                <MovementsView
                  key={currency}
                  data={data}
                  currency={currency}
                  onEdit={(edit) => open("transaction", edit)}
                  onAction={runAction}
                  onTransfer={() => open("transfer")}
                  newTransactionId={newTransactionId}
                />
              )}
              {view === "Planificación" && (
                <PlanningView
                  key={currency}
                  data={data}
                  currency={currency}
                  onCreate={(kind) => open(kind)}
                  onEdit={(item) => open("recurrence", item)}
                  onUpgrade={() => setUpgradeFeature("Proyección a 36 meses")}
                  onAction={runAction}
                />
              )}
              {view === "Informes" && (
                <ReportsView key={currency} data={data} currency={currency} />
              )}
              {(view === "Reglas" || view === "Alertas") && (
                <AutomationView
                  key={`${view}-${currency}`}
                  data={data}
                  currency={currency}
                  view={view}
                  onAction={action}
                  onView={changeView}
                />
              )}
              {(view === "Presupuestos" || view === "Objetivos") && (
                <TargetsView
                  view={view}
                  data={data}
                  currency={currency}
                  onCreate={() =>
                    open(view === "Presupuestos" ? "budget" : "goal")
                  }
                  onEdit={(edit) =>
                    open(view === "Presupuestos" ? "budget" : "goal", edit)
                  }
                  onAction={runAction}
                />
              )}
              {view === "Simulador" && (
                <SimulatorView
                  key={currency}
                  data={data}
                  currency={currency}
                  onAction={action}
                />
              )}
              {view === "Ajustes" && (
                <SettingsView
                  data={data}
                  user={user}
                  onCreateCategory={() => open("category")}
                  onAction={action}
                />
              )}
              {view === "Simular préstamo" && (
                <LoanLab
                  key={currency}
                  data={data}
                  currency={currency}
                  onAction={action}
                />
              )}
              {view === "Monedas" && (
                <FxView
                  key={currency}
                  data={data}
                  currency={currency}
                  onAction={action}
                />
              )}
              {(view === "Tarjetas" || view === "Préstamos") && (
                <CreditView
                  key={`${view}-${currency}-${creditMode}`}
                  view={view}
                  data={data}
                  currency={currency}
                  onAction={action}
                  initialMode={creditMode}
                />
              )}
            </>
          )}
          <footer>Finora · Simple por fuera. Preciso por dentro.</footer>
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
        {primaryTabs.map((name) => {
          const Icon = tabs.find((t) => t.name === name)!.icon;
          return (
            <button
              key={name}
              aria-current={view === name ? "page" : undefined}
              onClick={() => changeView(name)}
            >
              <Icon size={22} />
              <span>{name}</span>
            </button>
          );
        })}
      </nav>
      <button
        className="mobile-fab"
        aria-label="Agregar movimiento"
        disabled={busy}
        onClick={() => setRecordOpen(true)}
      >
        <Plus size={26} />
      </button>
      {recordOpen && (
        <RecordSheet
          onClose={() => setRecordOpen(false)}
          onChoose={chooseRecord}
        />
      )}
      {quickType && (
        <QuickRecord
          data={data}
          currency={currency}
          initialType={quickType}
          onClose={() => setQuickType(null)}
          onSave={action}
          onSaved={(id, nextCurrency) => {
            setNewTransactionId(id);
            changeView("Movimientos");
            setCurrency(nextCurrency);
          }}
        />
      )}
      {dialog && (
        <FinanceDialog
          key={`${dialog.kind}-${dialog.edit?.id ?? "new"}`}
          kind={dialog.kind}
          edit={dialog.edit}
          initialType={dialog.initialType}
          data={data}
          onClose={() => setDialog(null)}
          onSave={action}
        />
      )}
    </div>
  );
}
