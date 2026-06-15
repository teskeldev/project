import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listModels, createModel } from "@/lib/ai/fusion/store";
import { modelCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "models",
  list: listModels,
  create: createModel,
  createSchema: modelCreate,
});
