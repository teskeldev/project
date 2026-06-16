import type { Metadata } from "next";
import DocsPage from "./docs-client";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Everything you need to know about Teskel — installation, AI features, terminal, configuration, and the extension API.",
  openGraph: {
    title: "Documentation · Teskel",
    description:
      "Everything you need to know about Teskel — installation, AI features, terminal, configuration, and the extension API.",
    url: "/docs",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Documentation · Teskel",
    description:
      "Everything you need to know about Teskel — installation, AI features, terminal, configuration, and the extension API.",
  },
};

export default function Page() {
  return <DocsPage />;
}
