import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@finora/db";
import { sendAuthEmail } from "./mail";
import { trustedOrigins } from "./origins";

function makeAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configurá BETTER_AUTH_SECRET con al menos 32 caracteres.");
  return betterAuth({
    appName: "Finora",
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
    trustedOrigins: trustedOrigins(),
    database: prismaAdapter(getDb(), {
      provider: "postgresql",
      transaction: true,
    }),
    account: { modelName: "AuthAccount", encryptOAuthTokens: true },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification:
        process.env.REQUIRE_EMAIL_VERIFICATION === "true",
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail(user.email, "Recuperá tu contraseña", url),
    },
    emailVerification: {
      sendOnSignUp: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail(user.email, "Verificá tu email", url),
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await getDb().$transaction(async (tx) => {
            const owned = await tx.workspace.findMany({
              where: { ownerId: user.id },
              select: { id: true },
            });
            const workspaceId = { in: owned.map((w) => w.id) };
            await tx.transaction.deleteMany({ where: { workspaceId } });
            await tx.recurrence.deleteMany({ where: { workspaceId } });
            await tx.installmentPlan.deleteMany({ where: { workspaceId } });
            await tx.creditCard.deleteMany({ where: { workspaceId } });
            await tx.debt.deleteMany({ where: { workspaceId } });
            await tx.budget.deleteMany({ where: { workspaceId } });
            await tx.rule.deleteMany({where:{workspaceId}});
            await tx.category.deleteMany({ where: { workspaceId } });
            await tx.account.deleteMany({ where: { workspaceId } });
            await tx.workspace.deleteMany({ where: { id: workspaceId } });
          });
        },
      },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies:
        process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  });
}
let instance: ReturnType<typeof makeAuth> | undefined;
export function getAuth() {
  return (instance ??= makeAuth());
}
