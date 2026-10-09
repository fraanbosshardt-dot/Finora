import { AuthForm } from "../../components/auth-form";
import { signupIntent } from "../../lib/signup-intent";
export const metadata = {
  title: "Iniciar sesión · Finora",
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
  return (
    <AuthForm
      mode="signin"
      destination={intent.destination}
      intentQuery={intent.query}
      googleEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      )}
    />
  );
}
