"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

export default function CTA() {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 10, stiffness: 400, mass: 0.5 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    
    const center = { x: left + width / 2, y: top + height / 2 };
    const distance = Math.sqrt(Math.pow(clientX - center.x, 2) + Math.pow(clientY - center.y, 2));
    
    // Emulate magnetic pull within 150px radius
    if (distance < 150) {
      x.set((clientX - center.x) * 0.3);
      y.set((clientY - center.y) * 0.3);
    } else {
      x.set(0);
      y.set(0);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <section 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden px-6 py-32 md:py-48 bg-[#F7F7F5]"
    >
      {/* Environmental Ambient Mesh */}
      <motion.div 
        animate={{ 
          background: [
            "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.08) 0%, transparent 60%)",
            "radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.03) 0%, transparent 60%)",
            "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.08) 0%, transparent 60%)"
          ] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-0 -z-10"
      />

      <div className="mx-auto max-w-[1100px] text-center relative z-10">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.8 }}
          className="text-[3rem] font-semibold tracking-tighter text-slate-900 md:text-[4.5rem]"
        >
          Ready to build faster?
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mx-auto mt-6 max-w-xl text-[18px] text-slate-500"
        >
          Join the next generation of engineers building enduring software with an intelligence layer that actually understands your codebase.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-12 flex justify-center"
        >
          <motion.div
            style={{ x: smoothX, y: smoothY }}
            whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 10 } }}
            className="inline-block"
          >
            <Link 
              ref={buttonRef}
              href="/signup" 
              className="group relative inline-flex h-14 items-center gap-2 overflow-hidden rounded-full bg-slate-900 px-10 text-[16px] font-medium text-white shadow-[0_8px_30px_rgba(17,24,39,0.2)] transition-shadow hover:shadow-[0_12px_40px_rgba(17,24,39,0.3)]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full" />
              Start building for free
              <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
