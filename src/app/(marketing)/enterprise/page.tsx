import type { Metadata } from "next";
import EnterprisePage from "./enterprise-client";

export const metadata: Metadata = {
  title: "Enterprise",
  description:
    "Deploy AI-powered coding across your engineering team with enterprise security, compliance, SSO, SAML, and admin controls.",
  openGraph: {
    title: "Teskel for Enterprise",
    description:
      "Enterprise-grade security, SSO, SAML, admin dashboard, usage analytics, and self-hosted options for engineering teams.",
    url: "/enterprise",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teskel for Enterprise",
    description:
      "Enterprise-grade security, SSO, SAML, admin dashboard, usage analytics, and self-hosted options for engineering teams.",
  },
};

export default function Page() {
  return <EnterprisePage />;
}
