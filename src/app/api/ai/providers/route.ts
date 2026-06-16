import { AI_PROVIDERS } from "@/lib/ai/providers";
import { requireUser, handleApiError } from "@/lib/api";

/**
 * GET /api/ai/providers
 *
 * Returns the list of available AI providers and their models for the UI
 * model selector. The response is intentionally NOT wrapped in the standard
 * `{ success, data }` envelope because the client (`@/lib/client/providers`)
 * reads it with a direct `fetch` + `res.json()`.
 */
export async function GET() {
  try {
    // Require authentication before exposing provider information.
    await requireUser();

    // Return provider configs without exposing any secrets.
    // The UI can use this to populate model selectors.
    const providers = AI_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models,
      requiresApiKey: p.requiresApiKey,
    }));

    return Response.json({ providers });
  } catch (error) {
    return handleApiError(error);
  }
}
