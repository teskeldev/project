import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateModel, deleteModel } from "@/lib/ai/fusion/store";
import { modelUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateModel,
  remove: deleteModel,
  updateSchema: modelUpdate,
  deleteSchema: workspaceOnly,
});
