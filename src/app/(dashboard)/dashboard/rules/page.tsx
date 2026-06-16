import { redirect } from "next/navigation";

export default function RulesPage() {
  redirect("/dashboard/context?tab=rules");
}
