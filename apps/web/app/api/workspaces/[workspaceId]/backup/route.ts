import { z } from "zod";
import { backupSchema } from "@finora/core";
import {
  authorize,
  handle,
  json,
  readBody,
  limitMutation,
  todayAt,
} from "../../../../../lib/api";
import { snapshot } from "../../../../../lib/snapshot";
import { mutate } from "../../../../../lib/mutations";
export const GET = (
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) =>
  handle(async () => {
    const { workspaceId } = await context.params;
    await authorize(request, workspaceId);
    const data = backupSchema.parse({
      version: 3,
      exportedAt: new Date().toISOString(),
      ...(await snapshot(workspaceId, undefined, true)),
    });
    return json(data);
  });
export const POST = (
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) =>
  handle(async () => {
    const { workspaceId } = await context.params;
    const session = await authorize(request, workspaceId);
    await limitMutation(session.user.id);
    const data = backupSchema.parse(await readBody(request, 20 * 1024 * 1024));
    const key = z.string().uuid().parse(request.headers.get("idempotency-key"));
    await mutate(
      workspaceId,
      session.user.id,
      key,
      { action: "backup.restore", data },
      todayAt(session.workspace.timezone),
    );
    return json(await snapshot(workspaceId));
  });
