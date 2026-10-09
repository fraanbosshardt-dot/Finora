import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const envFile=resolve(import.meta.dirname,".env");
if(existsSync(envFile))process.loadEnvFile(envFile);
export default defineConfig({schema:"prisma/schema.prisma",datasource:{url:process.env.DATABASE_URL ?? "postgresql://finora:finora@localhost:5432/finora"}});
