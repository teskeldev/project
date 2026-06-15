import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listJudges, createJudge } from "@/lib/ai/fusion/store";
import { judgeCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "judges",
  list: listJudges,
  create: createJudge,
  createSchema: judgeCreate,
});
