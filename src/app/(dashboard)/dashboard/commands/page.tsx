import { redirect } from "next/navigation";

export default function CommandsPage() {
  redirect("/dashboard/context?tab=commands");
}
