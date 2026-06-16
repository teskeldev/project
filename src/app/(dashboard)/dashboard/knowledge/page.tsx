import { redirect } from "next/navigation";

export default function KnowledgePage() {
  redirect("/dashboard/context?tab=knowledge");
}
