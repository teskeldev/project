import registry from "@/data/extension-registry.json";

// GET /api/extensions/registry - public catalog data, no auth required
export async function GET() {
  return Response.json({ success: true, data: { extensions: registry } });
}
