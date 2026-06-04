import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import EditorDemo from "@/components/EditorDemo";
import SocialProof from "@/components/SocialProof";
import Features from "@/components/Features";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <SocialProof />
        <EditorDemo />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
