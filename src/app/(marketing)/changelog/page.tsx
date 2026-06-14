import type { Metadata } from "next";
import ChangelogPage from "./changelog-client";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "New features, improvements, and fixes in every Teskel release.",
  openGraph: {
    title: "Changelog · Teskel",
    description:
      "New features, improvements, and fixes in every Teskel release.",
    url: "/changelog",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Changelog · Teskel",
    description: "New features, improvements, and fixes in every Teskel release.",
  },
};

export default function Page() {
  return <ChangelogPage />;
}
