import { handle, json, authorize } from "../../../../../lib/api";
import { snapshot } from "../../../../../lib/snapshot";
export const GET = (
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) =>
  handle(async () => {
    const { workspaceId } = await context.params;
    await authorize(request, workspaceId);
    return json(await snapshot(workspaceId));
  });
