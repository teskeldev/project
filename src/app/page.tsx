import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import EditorDemo from "@/components/EditorDemo";
import Testimonials from "@/components/Testimonials";
import Features from "@/components/Features";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <EditorDemo />
        <Testimonials />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
