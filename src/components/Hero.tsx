"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import Link from "next/link";

const springTransition = {
  type: "spring" as const,
  stiffness: 200,
  damping: 15,
  mass: 0.8,
};

const titleText = "The AI workspace that builds with you.";
const words = titleText.split(" ");

export default function Hero() {
  const { scrollY } = useScroll();
  // Fluid physics for the background dot matrix shift
  const smoothY = useSpring(scrollY, { damping: 25, stiffness: 100 });
  const bgY = useTransform(smoothY, [0, 1000], [0, -150]);

  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-32 md:pb-32 md:pt-40 bg-[#F7F7F5]">
      {/* Spatial Grid Background */}
      <motion.div 
        style={{ y: bgY }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,#000_10%,transparent_100%)]" />
      </motion.div>

      <div className="mx-auto max-w-[1100px] text-center relative z-10">
        {/* Eyebrow */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-white/60 px-3.5 py-1.5 text-[13px] font-medium tracking-wide text-slate-600 shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(0,0,0,0.03)] backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-600 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          Teskel Beta 2.0 is live
        </motion.div>

        {/* Letter-Splitting Staggered Cascade */}
        <h1 className="mx-auto max-w-4xl text-[3.5rem] font-semibold leading-[1.05] tracking-tighter text-slate-900 md:text-[5.5rem] lg:text-[6.5rem] flex flex-wrap justify-center gap-x-4">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springTransition, delay: i * 0.05 + 0.2 }}
              className="inline-block"
            >
              {word === "builds" || word === "with" || word === "you." ? (
                <span className="bg-gradient-to-r from-blue-600 to-slate-900 bg-clip-text text-transparent mix-blend-multiply">{word}</span>
              ) : (
                word
              )}
            </motion.span>
          ))}
        </h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.6 }}
          className="mx-auto mt-8 max-w-2xl text-[18px] leading-relaxed text-slate-500 md:text-[21px]"
        >
          Stop fighting your editor. Teskel is a luminous, high-velocity environment where AI natively plans, builds, and reviews code across your entire repository.
        </motion.p>

        {/* Magnetic CTA Wrapper */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springTransition, delay: 0.8 }}
          className="mt-12 flex justify-center"
        >
          <MagneticButton />
        </motion.div>
      </div>
    </section>
  );
}

function MagneticButton() {
  // Simple magnetic hover logic
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Applying transform directly for performance
    el.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.02)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.transform = `translate(0px, 0px) scale(1)`;
  };

  return (
    <div 
      className="inline-block transition-transform duration-200 ease-out will-change-transform p-4 -m-4"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Link href="/signup" className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-blue-600 px-10 text-[16px] font-medium text-white shadow-[0_8px_30px_rgb(37,99,235,0.2)] transition-shadow hover:shadow-[0_12px_40px_rgb(37,99,235,0.3)]">
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full" />
        Start building for free
        <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
      </Link>
    </div>
  );
}
