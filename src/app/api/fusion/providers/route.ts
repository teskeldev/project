import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listProviders, createProvider } from "@/lib/ai/fusion/store";
import { providerCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "providers",
  list: listProviders,
  create: createProvider,
  createSchema: providerCreate,
});
