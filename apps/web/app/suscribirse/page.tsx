import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth";
import { getDb } from "@finora/db";
import { activePlan } from "../../lib/plans";
import { ProPaywall } from "../../components/pro-paywall";
import { Brand } from "../../components/brand";

export const metadata = {
  title: "Elegí Finora Pro",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const period =
    (await searchParams).period === "monthly" ? "monthly" : "yearly";
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/registro?plan=pro&period=${period}`);
  const membership = await getDb().workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });
  const isPro = membership ? activePlan(membership.workspace) === "PRO" : false;
  return (
    <main className="subscription-page">
      <Brand />
      <p className="muted">
        {session.user.name},{" "}
        {isPro
          ? "tu plan Pro ya está activo."
          : "tu cuenta está creada. Elegí cómo querés suscribirte."}
      </p>
      {!isPro && <ProPaywall feature="Tu suscripción" initialPeriod={period} />}
      <Link className="button-link secondary" href="/app">
        {isPro ? "Volver a mi espacio" : "Continuar con Free por ahora"}
      </Link>
    </main>
  );
}
