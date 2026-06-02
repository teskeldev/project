import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import EditorDemo from "@/components/EditorDemo";
import SocialProof from "@/components/SocialProof";
import Features from "@/components/Features";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <EditorDemo />
        <SocialProof />
        <Features />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
