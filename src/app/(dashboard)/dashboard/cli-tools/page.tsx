import { redirect } from "next/navigation";

export default function CliToolsPage() {
  redirect("/dashboard/integrations?tab=setup");
}
