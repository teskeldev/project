"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

const bentoContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const bentoItem = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15, mass: 0.8 },
  },
};

// Spatial Spotlight Card using pure CSS custom attributes via onPointerMove
function GlowingBentoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    divRef.current.style.setProperty("--x", `${x}px`);
    divRef.current.style.setProperty("--y", `${y}px`);
  };

  return (
    <motion.div
      ref={divRef}
      onPointerMove={handlePointerMove}
      variants={bentoItem}
      className={`group relative overflow-hidden rounded-[32px] bg-white/60 p-8 backdrop-blur-2xl transition-shadow duration-500 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(0,0,0,0.03),0_24px_64px_rgba(37,99,235,0.08)] shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(0,0,0,0.03)] border border-white/40 ${className}`}
    >
      {/* Dynamic Spatial Spotlight mask driven by CSS vars */}
      <div 
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 will-change-transform"
        style={{
          background: `radial-gradient(400px circle at var(--x, 50%) var(--y, 50%), rgba(37,99,235,0.08), transparent 40%)`
        }}
      />
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="features" className="px-6 py-24 md:py-32 bg-[#F7F7F5]">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="text-[2.75rem] font-semibold tracking-tighter text-slate-900 md:text-[3.75rem]"
          >
            Spatial intelligence for code.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-[18px] text-slate-500"
          >
            Not just an autocomplete. A living system that maps the structural DNA of your architecture in real-time.
          </motion.p>
        </div>

        {/* Asymmetrical Bento Grid */}
        <motion.div
          variants={bentoContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-6 md:grid-cols-3 md:grid-rows-[auto_auto]"
        >
          {/* Main Card: Context Engine (Span 2 cols) */}
          <GlowingBentoCard className="md:col-span-2">
            <h3 className="text-[24px] font-semibold tracking-tight text-slate-900">Real-time Context Engine</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500">
              Teskel processes hundreds of files instantly using localized AST scanning. It watches what you type and updates its memory matrix in real-time.
            </p>
            
            {/* Micro-UI: Indexing Chamber */}
            <div className="mt-10 flex-1 rounded-2xl border border-blue-500/10 bg-white/50 p-6 relative overflow-hidden">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="relative flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" style={{ animationDuration: '2s' }}></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
                </div>
                <span className="text-[13px] font-medium text-slate-600">AST Indexer Active</span>
              </div>
              
              <div className="mt-6 relative h-[100px]">
                {/* Simulated floating nodes into a chamber */}
                <motion.div 
                  animate={{ y: [40, 0, -10], opacity: [0, 1, 0], scale: [0.8, 1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute left-4 top-4 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] shadow-sm text-slate-600"
                >
                  <span className="text-blue-500">@</span> auth/route.ts
                </motion.div>
                <motion.div 
                  animate={{ y: [40, 0, -10], opacity: [0, 1, 0], scale: [0.8, 1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 2.5, delay: 0.8, ease: "easeInOut" }}
                  className="absolute left-32 top-8 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] shadow-sm text-slate-600"
                >
                  <span className="text-blue-500">@</span> lib/db.ts
                </motion.div>
                <motion.div 
                  animate={{ y: [40, 0, -10], opacity: [0, 1, 0], scale: [0.8, 1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 1.5, ease: "easeInOut" }}
                  className="absolute left-16 top-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] shadow-sm text-slate-600"
                >
                  <span className="text-blue-500">@</span> Nav.tsx
                </motion.div>
                
                {/* Chamber Target */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-blue-500/20 bg-blue-50/50 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.1)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/><polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
              </div>
            </div>
          </GlowingBentoCard>

          {/* Metrics Card (Span 1 col) */}
          <GlowingBentoCard className="md:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[24px] font-semibold tracking-tight text-slate-900">Zero-Friction Models</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                Intelligently routes trivial tasks to high-speed models (Teskel-Flash) and complex reasoning to frontier models.
              </p>
            </div>
            
            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-gray-200/50 bg-white/50 p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Latency Profile</div>
                <div className="mt-1 text-[32px] font-bold tracking-tighter text-slate-900">120<span className="text-[18px] text-slate-500">ms</span></div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/30 p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Accuracy Vector</div>
                <div className="mt-1 text-[32px] font-bold tracking-tighter text-emerald-700">99.9<span className="text-[18px] text-emerald-600/70">%</span></div>
              </div>
            </div>
          </GlowingBentoCard>

          {/* Sync Card (Span 3 cols wide bottom) */}
          <GlowingBentoCard className="md:col-span-3 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <h3 className="text-[24px] font-semibold tracking-tight text-slate-900">Living Codebase Sync</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-500 max-w-xl">
                Your repository isn&apos;t static. As you switch branches, pull changes, or refactor, Teskel&apos;s vector representations shift seamlessly without re-indexing friction.
              </p>
            </div>
            
            {/* Breathing Vector Meter */}
            <div className="w-full md:w-96 rounded-2xl border border-gray-200/50 bg-white p-6 shadow-sm">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-500">Vector Embeddings</span>
                  <span className="text-[12px] font-medium text-emerald-600 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2 items-center justify-center"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40"></span><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span></span>
                    Synced
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 relative">
                  <motion.div 
                    animate={{ width: ["98%", "100%", "98%"], opacity: [0.8, 1, 0.8] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500" 
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>Branch: feature/auth-v2</span>
                  <span>14,032 chunks</span>
                </div>
              </div>
            </div>
          </GlowingBentoCard>
        </motion.div>
      </div>
    </section>
  );
}
