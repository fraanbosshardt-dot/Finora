import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, ".local/postgres");
const credentials = resolve(root, ".local/database.json");
await mkdir(resolve(root, ".local"), { recursive: true });
let config;
if (existsSync(credentials))
  config = JSON.parse(await readFile(credentials, "utf8"));
else {
  config = {
    user: "finora",
    password: randomBytes(24).toString("hex"),
    port: 55432,
  };
  await writeFile(credentials, JSON.stringify(config), { mode: 0o600 });
}
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: config.user,
  password: config.password,
  port: config.port,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(directory, "PG_VERSION"))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
if (
  !(
    await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      "finora",
    ])
  ).rowCount
)
  await postgres.createDatabase("finora");
await client.end();
const url = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/finora`;
const webEnv = resolve(root, "apps/web/.env.local");
if (!existsSync(webEnv))
  await writeFile(
    webEnv,
    `DATABASE_URL="${url}"\nBETTER_AUTH_SECRET="${randomBytes(48).toString("base64url")}"\nBETTER_AUTH_URL="http://127.0.0.1:3000"\nREQUIRE_EMAIL_VERIFICATION="false"\n`,
    { mode: 0o600 },
  );
const dbEnv = resolve(root, "packages/db/.env");
if (!existsSync(dbEnv))
  await writeFile(dbEnv, `DATABASE_URL="${url}"\n`, { mode: 0o600 });
console.log(
  `PostgreSQL local listo en 127.0.0.1:${config.port}. Datos persistentes en .local/postgres.`,
);
console.log(
  "Variables locales preparadas. En otra terminal: pnpm db:migrate y pnpm dev.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
