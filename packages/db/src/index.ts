import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
export { Prisma } from "../generated/client";
const globalDb = globalThis as unknown as { finoraPrisma?: PrismaClient };
export function getDb(): PrismaClient {
  if (globalDb.finoraPrisma) return globalDb.finoraPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("Configurá DATABASE_URL antes de iniciar Finora.");
  globalDb.finoraPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return globalDb.finoraPrisma;
}
