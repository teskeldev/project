import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateTeam, deleteTeam } from "@/lib/ai/fusion/store";
import { teamUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateTeam,
  remove: deleteTeam,
  updateSchema: teamUpdate,
  deleteSchema: workspaceOnly,
});
