import type { Metadata } from "next";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import EditorDemo from "@/components/EditorDemo";
import Features from "@/components/Features";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";

export const metadata: Metadata = {
  title: "Teskel — AI-Powered Coding Workspace",
  description:
    "Teskel is the AI-powered coding workspace that helps teams ship software faster with deep context, real-time collaboration, and intelligent agents.",
  openGraph: {
    title: "Teskel — AI-Powered Coding Workspace",
    description:
      "Plan, search, build anything. Teskel is the AI-powered coding workspace that helps teams ship software faster.",
    url: "/",
    siteName: "Teskel",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teskel — AI-Powered Coding Workspace",
    description:
      "Plan, search, build anything. Teskel is the AI-powered coding workspace that helps teams ship software faster.",
  },
};

export default function Home() {
  return (
    <>
      <Hero />
      <SocialProof />
      <EditorDemo />
      <Features />
      <FAQ />
      <CTA />
    </>
  );
}
