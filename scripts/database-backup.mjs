import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomBytes } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
if (!process.env.DATABASE_URL && existsSync(join(root, "packages/db/.env")))
  process.loadEnvFile(join(root, "packages/db/.env"));
const require = createRequire(import.meta.url);
const embeddedRequire = createRequire(require.resolve("embedded-postgres"));
const { Client } = embeddedRequire("pg");
const run = promisify(execFile);
const mode = process.argv[2] ?? "backup";
const pathArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("Configurá DATABASE_URL.");
const bin = process.env.PG_BIN_DIR ?? join(root, ".local/pgtools/bin");
const program = (name) => {
  const local = join(
    bin,
    `${name}${process.platform === "win32" ? ".exe" : ""}`,
  );
  return existsSync(local) ? local : name;
};
function connection(url) {
  const parsed = new URL(url);
  return {
    args: [
      "--host",
      parsed.hostname,
      "--port",
      parsed.port || "5432",
      "--username",
      decodeURIComponent(parsed.username),
      "--dbname",
      decodeURIComponent(parsed.pathname.slice(1)),
    ],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGSSLMODE: parsed.searchParams.get("sslmode") ?? "prefer",
    },
  };
}
async function command(name, args, url) {
  const c = connection(url);
  try {
    return await run(program(name), [...c.args, ...args], {
      env: c.env,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `Falló ${name}. Verificá herramientas PostgreSQL, permisos y conexión (código ${error.code ?? "desconocido"}).`,
    );
  }
}
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
async function counts(client) {
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const result = {};
  for (const row of tables)
    result[row.tablename] = (
      await client.query(
        `SELECT count(*)::text AS count FROM public.${quote(row.tablename)}`,
      )
    ).rows[0].count;
  return result;
}
async function backup() {
  await mkdir(join(root, ".local/backups"), { recursive: true });
  const file = pathArg
    ? resolve(pathArg)
    : join(
        root,
        ".local/backups",
        `finora-${new Date().toISOString().replaceAll(":", "-")}.dump`,
      );
  if (existsSync(file))
    throw new Error("El archivo ya existe; elegí otro nombre.");
  const client = new Client({ connectionString: sourceUrl });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (
      await client.query("SELECT pg_export_snapshot() AS snapshot")
    ).rows[0].snapshot;
    const rows = await counts(client);
    await command(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${snapshot}`,
        `--file=${file}`,
      ],
      sourceUrl,
    );
    const hash = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    await writeFile(
      `${file}.manifest.json`,
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          sha256: hash,
          counts: rows,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await client.query("COMMIT");
    console.log(`Respaldo creado: ${file}`);
    return file;
  } finally {
    await client.end();
  }
}
async function verifyFile(file) {
  const manifest = JSON.parse(await readFile(`${file}.manifest.json`, "utf8"));
  const hash = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  if (hash !== manifest.sha256)
    throw new Error("El checksum del respaldo no coincide.");
  return manifest;
}
async function restore(file, target) {
  await verifyFile(file);
  await command(
    "pg_restore",
    ["--single-transaction", "--exit-on-error", "--no-owner", "--no-acl", file],
    target,
  );
}
if (mode === "backup") await backup();
else if (mode === "verify") {
  const file = pathArg ? resolve(pathArg) : await backup();
  const manifest = await verifyFile(file);
  const name = `finora_verify_${randomBytes(8).toString("hex")}`;
  const admin = new Client({ connectionString: sourceUrl });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${quote(name)}`);
    created = true;
    const target = new URL(sourceUrl);
    target.pathname = `/${name}`;
    await restore(file, target.toString());
    const client = new Client({ connectionString: target.toString() });
    await client.connect();
    try {
      const actual = await counts(client);
      if (JSON.stringify(actual) !== JSON.stringify(manifest.counts))
        throw new Error(
          "Los conteos restaurados no coinciden con el respaldo.",
        );
      console.log(
        `Recuperación verificada: ${Object.keys(actual).length} tablas, checksum y conteos correctos.`,
      );
    } finally {
      await client.end();
    }
  } finally {
    if (created) await admin.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
    await admin.end();
  }
} else if (mode === "restore") {
  if (!pathArg || !process.env.RESTORE_DATABASE_URL)
    throw new Error(
      "Usá --file y RESTORE_DATABASE_URL apuntando a una base destino vacía.",
    );
  const source = new URL(sourceUrl),
    target = new URL(process.env.RESTORE_DATABASE_URL);
  if (source.origin === target.origin && source.pathname === target.pathname)
    throw new Error("El destino no puede ser la base activa de origen.");
  const client = new Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const tables = await counts(client);
    if (Object.keys(tables).length)
      throw new Error("La base destino debe estar vacía.");
  } finally {
    await client.end();
  }
  await restore(resolve(pathArg), target.toString());
  console.log("Base restaurada en el destino vacío indicado.");
} else throw new Error("Modo inválido: backup, verify o restore.");
