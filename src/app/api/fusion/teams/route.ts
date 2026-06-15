import { collectionHandlers } from "@/lib/ai/fusion/route-helpers";
import { listTeams, createTeam } from "@/lib/ai/fusion/store";
import { teamCreate } from "@/lib/ai/fusion/schemas";

export const { GET, POST } = collectionHandlers({
  resultKey: "teams",
  list: listTeams,
  create: createTeam,
  createSchema: teamCreate,
});
