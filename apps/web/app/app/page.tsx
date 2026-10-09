import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../../lib/auth";
import { getDb } from "@finora/db";
import { todayAt } from "../../lib/api";
import { Dashboard } from "../../components/dashboard";
import { Onboarding } from "../../components/onboarding";
export const metadata = {
  title: "Mi espacio · Finora",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    upgrade?: string | string[];
    period?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const destination =
    params.upgrade === "pro"
      ? `/suscribirse?period=${params.period === "monthly" ? "monthly" : "yearly"}`
      : "/app";
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/ingresar");
  const membership = await getDb().workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });
  return membership ? (
    <Dashboard
      workspaceId={membership.workspaceId}
      user={{ name: session.user.name, email: session.user.email }}
    />
  ) : (
    <Onboarding
      name={session.user.name}
      today={todayAt()}
      destination={destination}
    />
  );
}
