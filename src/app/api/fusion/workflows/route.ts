import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listWorkflows, createWorkflow } from "@/lib/ai/fusion/store";
import { workflowCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "workflows",
  list: listWorkflows,
  create: createWorkflow,
  createSchema: workflowCreate,
});
