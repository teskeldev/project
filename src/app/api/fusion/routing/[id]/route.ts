import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateRouting, deleteRouting } from "@/lib/ai/fusion/store";
import { routingUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateRouting,
  remove: deleteRouting,
  updateSchema: routingUpdate,
  deleteSchema: workspaceOnly,
});
