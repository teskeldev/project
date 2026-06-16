"use client";

import { Separator } from "@/components/ui";
import ProfileTab from "./ProfileTab";
import AppearanceTab from "./AppearanceTab";
import NotificationsTab from "./NotificationsTab";

export default function GeneralTab() {
  return (
    <div className="space-y-10">
      <ProfileTab />
      <Separator />
      <AppearanceTab />
      <Separator />
      <NotificationsTab />
    </div>
  );
}
