import { z } from "zod";
import { getDb, Prisma } from "@finora/db";
import { getAuth } from "./auth";
import { trustedOrigins } from "./origins";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function todayAt(timezone = "America/Argentina/Buenos_Aires") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
export async function sessionFor(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new ApiError(401, "Iniciá sesión para continuar.");
  return session;
}
export async function authorize(request: Request, workspaceId: string) {
  z.string().uuid().parse(workspaceId);
  const session = await sessionFor(request);
  const membership = await getDb().workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    include: { workspace: true },
  });
  if (!membership) throw new ApiError(404, "No encontramos ese espacio.");
  return { ...session, workspace: membership.workspace };
}
export async function readBody(
  request: Request,
  maxBytes = 512000,
): Promise<unknown> {
  if (!trustedOrigins().includes(request.headers.get("origin") ?? ""))
    throw new ApiError(403, "Origen de la solicitud no permitido.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "Usá JSON para enviar los datos.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Faltan los datos.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError(
        413,
        `El archivo supera el límite de ${Math.floor(maxBytes / 1024)} KB.`,
      );
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    throw new ApiError(400, "JSON inválido.");
  }
}
export async function limitMutation(userId: string) {
  const slot = Math.floor(Date.now() / 60000);
  const key = `mutation:${userId}:${slot}`;
  const row = await getDb().rateLimit.upsert({
    where: { key },
    create: { key, count: 1, lastRequest: BigInt(Date.now()) },
    update: { count: { increment: 1 }, lastRequest: BigInt(Date.now()) },
  });
  if (row.count > 100)
    throw new ApiError(429, "Demasiadas solicitudes. Esperá un minuto.");
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function handle(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: error.issues[0]?.message ?? "Revisá los datos ingresados." },
        400,
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return json(
        {
          error:
            "Ese registro ya existe. Actualizá la página para ver el estado actual.",
        },
        409,
      );
    console.error("Finora request failed", {
      type: error instanceof Error ? error.name : "Unknown",
      ...(process.env.NODE_ENV === "development" && error instanceof TypeError ? {message:error.message} : {}),
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "INTERNAL",
    });
    return json(
      { error: "No pudimos completar la operación. Volvé a intentar." },
      500,
    );
  }
}
