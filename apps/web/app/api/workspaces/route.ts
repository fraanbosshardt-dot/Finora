import { z } from "zod";
import { getDb } from "@finora/db";
import { categoryLibrary, accountSchema } from "@finora/core";
import {
  handle,
  json,
  sessionFor,
  readBody,
  limitMutation,
  todayAt,
  toDate,
  ApiError,
} from "../../../lib/api";
export const GET = (request: Request) =>
  handle(async () => {
    const session = await sessionFor(request);
    const memberships = await getDb().workspaceMember.findMany({
      where: { userId: session.user.id },
      include: { workspace: true },
    });
    return json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      workspaces: memberships.map((m) => m.workspace),
    });
  });
const onboarding = z.object({
  name: z.string().trim().min(1).max(80),
  country: z.enum(["AR", "UY", "CL", "ES", "US", "MX", "BR"]),
  currency: z.enum(["ARS", "USD", "EUR"]),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("es", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Zona horaria inválida"),
  account: accountSchema,
});
export const POST = (request: Request) =>
  handle(async () => {
    const session = await sessionFor(request);
    const input = onboarding.parse(await readBody(request));
    await limitMutation(session.user.id);
    if (
      input.account.currency !== input.currency ||
      input.account.openingDate > todayAt(input.timezone)
    )
      throw new ApiError(400, "Revisá la moneda y la fecha del saldo inicial.");
    const existing = await getDb().workspace.findUnique({
      where: { ownerId: session.user.id },
    });
    if (existing) return json({ workspace: existing });
    const workspace = await getDb().workspace.create({
      data: {
        name: input.name,
        country: input.country,
        baseCurrency: input.currency,
        timezone: input.timezone,
        ownerId: session.user.id,
        members: { create: { userId: session.user.id, role: "owner" } },
        categories: { create: categoryLibrary },
        accounts: {
          create: {
            id: input.account.id,
            name: input.account.name,
            currency: input.account.currency,
            openingMinor: input.account.openingMinor,
            openingDate: toDate(input.account.openingDate),
            kind: input.account.kind ?? "bank",
            liquid: true,
          },
        },
      },
    });
    return json({ workspace }, 201);
  });
