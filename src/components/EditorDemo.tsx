"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";

export default function EditorDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 3D Parallax Perspective Tilt values
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  
  const springConfig = { damping: 20, stiffness: 100, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateY = useTransform(smoothMouseX, [0, 1], [-6, 6]);
  const rotateX = useTransform(smoothMouseY, [0, 1], [6, -6]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Normalize coordinates between 0 and 1
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  // Agent State Machine simulation
  const [phase, setPhase] = useState(0);

  return (
    <section className="relative overflow-visible px-6 py-20 pb-32 md:py-24 bg-[#F7F7F5] perspective-1000">
      <div className="mx-auto max-w-[1100px]">
        
        {/* Floating 3D IDE Sandbox */}
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ rotateX, rotateY, transformPerspective: 1200 }}
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          onViewportEnter={() => {
            // Trigger State-Machine
            setTimeout(() => setPhase(1), 800); // Terminal logs start
            setTimeout(() => setPhase(2), 2200); // Code writing starts
            setTimeout(() => setPhase(3), 3500); // Ghost autocomplete slides in
          }}
          transition={{ type: "spring", stiffness: 100, damping: 25, mass: 0.8 }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[20px] border border-white/60 bg-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(0,0,0,0.03),0_24px_64px_rgba(17,24,39,0.06)] backdrop-blur-2xl will-change-transform"
        >
          {/* MacOS Title Bar */}
          <div className="flex items-center justify-between border-b border-black/[0.04] bg-white/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#FF5F56] shadow-sm border border-black/10" />
              <div className="h-3 w-3 rounded-full bg-[#FFBD2E] shadow-sm border border-black/10" />
              <div className="h-3 w-3 rounded-full bg-[#27C93F] shadow-sm border border-black/10" />
            </div>
            {/* Premium AI Selector */}
            <div className="flex items-center gap-2 rounded-md border border-black/[0.04] bg-white/80 px-3 py-1 shadow-sm">
              <div className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              </div>
              <span className="text-[11px] font-bold tracking-wide text-slate-700">Teskel-Flash v2</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 text-slate-400"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="w-[60px]" />
          </div>

          {/* Dual Panel Architecture */}
          <div className="flex h-[450px] md:h-[500px]">
            {/* Phase 1: Agent Reasoning Terminal */}
            <div className="hidden w-[280px] flex-col border-r border-black/[0.04] bg-slate-50/50 p-5 md:flex relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-slate-50/80 z-10 pointer-events-none" />
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Agent Reasoning</p>
              
              <div className="mt-5 space-y-3 font-mono text-[11px] text-slate-500">
                <div className="text-blue-600 font-semibold mb-4 text-[12px] font-sans">
                  &quot;Build a layout component using Framer Motion.&quot;
                </div>
                
                {phase >= 1 && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <span className="text-slate-400">❯</span> Scanning AST...
                  </motion.div>
                )}
                {phase >= 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <span className="text-emerald-500">✓</span> 337 files synchronized.
                  </motion.div>
                )}
                {phase >= 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                    <span className="text-slate-400">❯</span> Locating motion utilities...
                  </motion.div>
                )}
                {phase >= 2 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-xl border border-blue-500/10 bg-white p-3 shadow-sm text-slate-600 font-sans">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[8px] text-blue-600">✨</div>
                      <span className="font-semibold text-[11px]">Executing Plan</span>
                    </div>
                    Writing <span className="font-mono text-blue-500">Layout.tsx</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Simulated AI Cognition (Code Editor) */}
            <div className="relative flex-1 bg-white/60 p-6 font-mono text-[13px] leading-[1.8] text-slate-600 overflow-hidden">
              <div className="text-slate-400">{"// Layout.tsx"}</div>
              
              {phase >= 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mt-4">
                    <span className="text-purple-600">import</span> {"{"} motion {"}"} <span className="text-purple-600">from</span> <span className="text-emerald-600">&quot;framer-motion&quot;</span>;
                  </div>
                  <div className="mt-2"><span className="text-purple-600">export default function</span> <span className="text-blue-600">RootLayout</span>({"{"} children {"}"}: {"{"} children: ReactNode {"}"}) {"{"}</div>
                  <div className="ml-4 mt-2"><span className="text-purple-600">return</span> (</div>
                  <div className="ml-8 mt-1 text-slate-500">&lt;<span className="text-blue-500">div</span> className=<span className="text-emerald-600">&quot;min-h-screen&quot;</span>&gt;</div>
                  <div className="ml-12 mt-1 text-slate-500">&lt;<span className="text-blue-500">Sidebar</span> /&gt;</div>
                </motion.div>
              )}

              {/* Phase 3: Simulated Magic Autocomplete */}
              {phase >= 3 && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="ml-12 mt-2 flex items-center gap-2 relative"
                >
                  {/* Radiant Pulse Wave */}
                  <motion.div 
                    initial={{ left: 0, width: 0, opacity: 1 }}
                    animate={{ left: "100%", opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent blur-md z-10"
                  />
                  
                  {/* Ghost Text */}
                  <div className="rounded-md border border-blue-200/50 bg-blue-50/40 py-1 pl-2 pr-3 text-slate-400 italic relative overflow-hidden">
                    <span className="text-blue-500/80">&lt;motion.main</span>
                    <div className="ml-4">initial={"{{ opacity: 0, y: 20 }}"}</div>
                    <div className="ml-4">animate={"{{ opacity: 1, y: 0 }}"}</div>
                    <div className="ml-4">className=<span className="text-emerald-600/60">&quot;flex-1 p-6&quot;</span></div>
                    <span className="text-blue-500/80">&gt;</span>
                    <div className="ml-4 text-slate-500">{"{children}"}</div>
                    <span className="text-blue-500/80">&lt;/motion.main&gt;</span>
                  </div>
                  <div className="rounded-md border border-black/[0.05] bg-white px-2 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm relative z-20">
                    TAB
                  </div>
                </motion.div>
              )}
              
              {phase >= 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                  <div className="ml-8 mt-2 text-slate-500">&lt;/<span className="text-blue-500">div</span>&gt;</div>
                  <div className="ml-4">);</div>
                  <div>{"}"}</div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
