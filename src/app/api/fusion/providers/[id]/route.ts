import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateProvider, deleteProvider } from "@/lib/ai/fusion/store";
import { providerUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateProvider,
  remove: deleteProvider,
  updateSchema: providerUpdate,
  deleteSchema: workspaceOnly,
});
