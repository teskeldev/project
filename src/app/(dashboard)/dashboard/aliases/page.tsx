import { redirect } from "next/navigation";

export default function AliasesPage() {
  redirect("/dashboard/integrations?tab=aliases");
}
