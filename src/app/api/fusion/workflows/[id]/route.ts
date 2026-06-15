import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateWorkflow, deleteWorkflow } from "@/lib/ai/fusion/store";
import { workflowUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateWorkflow,
  remove: deleteWorkflow,
  updateSchema: workflowUpdate,
  deleteSchema: workspaceOnly,
});
