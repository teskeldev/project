import { redirect } from "next/navigation";

export default function SkillsPage() {
  redirect("/dashboard/context?tab=skills");
}
