export function signupIntent(params: {
  plan?: string | string[];
  period?: string | string[];
}) {
  const pro = params.plan === "pro";
  const period = params.period === "monthly" ? "monthly" : "yearly";
  return {
    pro,
    period,
    destination: pro ? `/suscribirse?period=${period}` : "/app",
    query: pro ? `?plan=pro&period=${period}` : "",
  };
}
