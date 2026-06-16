import registry from "@/data/extension-registry.json";
import { apiSuccess, handleApiError } from "@/lib/api";

// GET /api/extensions/registry - public catalog data, no auth required
export async function GET() {
  try {
    return apiSuccess({ extensions: registry });
  } catch (err) {
    return handleApiError(err);
  }
}
