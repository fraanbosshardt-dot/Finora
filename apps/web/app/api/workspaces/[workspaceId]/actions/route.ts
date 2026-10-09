import { z } from "zod";
import {
  handle,
  json,
  authorize,
  readBody,
  limitMutation,
  todayAt,
  ApiError,
} from "../../../../../lib/api";
import { commandSchema } from "../../../../../lib/commands";
import { mutate } from "../../../../../lib/mutations";
import { snapshot } from "../../../../../lib/snapshot";
import { activePlan, proActions } from "../../../../../lib/plans";
export const POST = (
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) =>
  handle(async () => {
    const { workspaceId } = await context.params;
    const session = await authorize(request, workspaceId);
    const command = commandSchema.parse(await readBody(request));
    if (proActions.has(command.action) && activePlan(session.workspace) !== "PRO")
      throw new ApiError(402, "Esta función requiere Finora Pro. Consultá los planes para continuar.");
    const key = z.string().uuid().parse(request.headers.get("idempotency-key"));
    await limitMutation(session.user.id);
    await mutate(
      workspaceId,
      session.user.id,
      key,
      command,
      todayAt(session.workspace.timezone),
    );
    return json(await snapshot(workspaceId));
  });
