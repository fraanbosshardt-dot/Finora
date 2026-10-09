import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { Client } = createRequire(resolve("packages/db/package.json"))("pg");

export async function setTestPlan(
  workspaceId: string,
  plan: "FREE" | "PRO",
  until = new Date(Date.now() + 86400000),
) {
  if (!process.env.DATABASE_URL) {
    const value = readFileSync("apps/web/.env.local", "utf8")
      .match(/^DATABASE_URL=(.+)$/m)?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, "");
    if (!value)
      throw new Error("Falta la base local para las pruebas de planes.");
    process.env.DATABASE_URL = value;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      'SELECT u.email FROM "Workspace" w JOIN "User" u ON u.id = w."ownerId" WHERE w.id = $1',
      [workspaceId],
    );
    if (!result.rows[0]?.email.endsWith("@example.test"))
      throw new Error(
        "Solo se pueden cambiar planes de usuarios temporales de prueba.",
      );
    await client.query(
      'UPDATE "Workspace" SET plan = $2, "proUntil" = $3 WHERE id = $1',
      [workspaceId, plan, plan === "PRO" ? until : null],
    );
  } finally {
    await client.end();
  }
}
