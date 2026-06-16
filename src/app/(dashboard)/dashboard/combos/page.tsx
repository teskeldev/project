import { redirect } from "next/navigation";

export default function CombosPage() {
  redirect("/dashboard/integrations?tab=routing");
}
