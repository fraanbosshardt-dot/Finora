export function trustedOrigins() {
  const configured = new URL(process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000");
  const origins = [configured.origin];
  if (process.env.NODE_ENV === "development" && ["127.0.0.1", "localhost"].includes(configured.hostname)) {
    const alternate = new URL(configured);
    alternate.hostname = configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(alternate.origin);
  }
  return origins;
}
