import { redirect } from "next/navigation";

export default function PermissionsRedirectPage() {
  redirect("/dashboard/settings?tab=security");
}
