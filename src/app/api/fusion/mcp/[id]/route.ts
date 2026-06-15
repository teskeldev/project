import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateMcpServer, deleteMcpServer } from "@/lib/ai/fusion/store";
import { mcpUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateMcpServer,
  remove: deleteMcpServer,
  updateSchema: mcpUpdate,
  deleteSchema: workspaceOnly,
});
