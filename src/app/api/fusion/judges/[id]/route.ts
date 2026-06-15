import { itemHandlers } from "@/lib/ai/fusion/route-helpers";
import { updateJudge, deleteJudge } from "@/lib/ai/fusion/store";
import { judgeUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

export const { PATCH, DELETE } = itemHandlers({
  update: updateJudge,
  remove: deleteJudge,
  updateSchema: judgeUpdate,
  deleteSchema: workspaceOnly,
});
