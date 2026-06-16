import { apiSuccess, handleApiError, requireUser } from "@/lib/api";
import { FUSION_TEMPLATES } from "@/lib/ai/fusion/templates";

// GET /api/fusion/templates — built-in (read-only) templates.
export async function GET() {
  try {
    await requireUser();
    return apiSuccess({ templates: FUSION_TEMPLATES });
  } catch (err) {
    return handleApiError(err);
  }
}
