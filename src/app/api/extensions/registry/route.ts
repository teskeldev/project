import registry from "@/data/extension-registry.json";
import { apiSuccess } from "@/lib/api";

// GET /api/extensions/registry - public catalog data, no auth required
export async function GET() {
  return apiSuccess({ extensions: registry });
}
