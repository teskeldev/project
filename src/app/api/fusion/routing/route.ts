import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listRoutings, createRouting } from "@/lib/ai/fusion/store";
import { routingCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "routings",
  list: listRoutings,
  create: createRouting,
  createSchema: routingCreate,
});
