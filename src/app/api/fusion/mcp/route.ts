import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listMcpServers, createMcpServer } from "@/lib/ai/fusion/store";
import { mcpCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "servers",
  list: listMcpServers,
  create: createMcpServer,
  createSchema: mcpCreate,
});
