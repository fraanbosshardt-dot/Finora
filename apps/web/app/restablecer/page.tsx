import { AuthForm } from "../../components/auth-form";
export const metadata = {
  title: "Nueva contraseña · Finora",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AuthForm mode="reset" />;
}
