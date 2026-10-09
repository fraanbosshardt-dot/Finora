import { AuthForm } from "../../components/auth-form";
import { signupIntent } from "../../lib/signup-intent";
import { getAuth } from "../../lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Crear cuenta · Finora",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string | string[];
    period?: string | string[];
  }>;
}) {
  const intent = signupIntent(await searchParams);
  if (await getAuth().api.getSession({ headers: await headers() }))
    redirect(intent.destination);
  return (
    <AuthForm
      mode="signup"
      destination={intent.destination}
      intentQuery={intent.query}
      googleEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      )}
    />
  );
}
