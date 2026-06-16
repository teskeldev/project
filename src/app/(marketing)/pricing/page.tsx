import type { Metadata } from "next";
import PricingPage from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for individuals, professionals, and teams. Start free, upgrade anytime.",
  openGraph: {
    title: "Pricing · Teskel",
    description:
      "Simple, transparent pricing for individuals, professionals, and teams. Start free, upgrade anytime.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pricing · Teskel",
    description:
      "Simple, transparent pricing for individuals, professionals, and teams.",
  },
};

export default function Page() {
  return <PricingPage />;
}
