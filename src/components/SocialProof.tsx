"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

export default function SocialProof() {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // We simulate deceleration on hover by tweaking the duration via a motion value? 
  // Native Framer Motion animation speed control is tricky without custom useAnimationFrame,
  // but we can use CSS animations or simply change the duration.
  // Given "deceleration physics", doing this with pure CSS + hover state is highly performant.

  return (
    <section className="relative overflow-hidden px-6 py-16 md:py-24 bg-[#F7F7F5]">
      <div className="mx-auto max-w-[1100px] border-t border-gray-200/40 pt-16 md:pt-20">
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400"
        >
          Built natively for the modern software stack
        </motion.p>

        {/* The Kinetic Infinite Ribbon */}
        <div 
          ref={containerRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative mt-12 flex overflow-hidden mask-edges"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          }}
        >
          <motion.div
            animate={{ x: isHovered ? ["-10%", "-12%"] : ["0%", "-50%"] }} // Slows down immensely
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                ease: "linear",
                duration: isHovered ? 100 : 35, // Deceleration
              }
            }}
            className="flex w-[200%] items-center justify-around"
            style={{ willChange: "transform" }}
          >
            {/* Track 1 */}
            <TechNode name="Next.js" hoverColor="hover:text-black" />
            <TechNode name="React" hoverColor="hover:text-[#61DAFB]" />
            <TechNode name="TypeScript" hoverColor="hover:text-[#3178C6]" />
            <TechNode name="Tailwind" hoverColor="hover:text-[#06B6D4]" />
            <TechNode name="Node.js" hoverColor="hover:text-[#339933]" />
            <TechNode name="Prisma" hoverColor="hover:text-black" />
            
            {/* Track 2 */}
            <TechNode name="Next.js" hoverColor="hover:text-black" />
            <TechNode name="React" hoverColor="hover:text-[#61DAFB]" />
            <TechNode name="TypeScript" hoverColor="hover:text-[#3178C6]" />
            <TechNode name="Tailwind" hoverColor="hover:text-[#06B6D4]" />
            <TechNode name="Node.js" hoverColor="hover:text-[#339933]" />
            <TechNode name="Prisma" hoverColor="hover:text-black" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TechNode({ name, hoverColor }: { name: string; hoverColor: string }) {
  return (
    <span className={`px-12 text-[26px] font-semibold tracking-tighter text-slate-300 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:text-opacity-100 ${hoverColor} hover:drop-shadow-lg`}>
      {name}
    </span>
  );
}
