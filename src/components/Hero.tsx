"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Download, Sparkles, Star, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

const stats = [
  { label: "Active developers", value: 200, suffix: "K+", icon: Users },
  { label: "Code completions/day", value: 50, suffix: "M+", icon: Zap },
  { label: "GitHub stars", value: 45, suffix: "K", icon: Star },
];

export default function Hero() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [2, -2]);
  const rotateY = useTransform(mouseX, [-300, 300], [-2, 2]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <section
      className="relative overflow-hidden px-6 pb-28 pt-32 md:pb-40 md:pt-44"
      onMouseMove={handleMouseMove}
    >
      {/* Animated mesh gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -left-[20%] -top-[20%] h-[60%] w-[60%] rounded-full bg-gradient-to-br from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 40, -20, 0],
            scale: [1, 0.95, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -right-[15%] top-[10%] h-[50%] w-[50%] rounded-full bg-gradient-to-bl from-slate-100/70 via-blue-50/30 to-transparent blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[30%] h-[40%] w-[40%] rounded-full bg-gradient-to-tr from-indigo-50/50 to-blue-50/30 blur-3xl"
        />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Announcement badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 flex justify-center md:justify-start"
        >
          <Link
            href="/changelog"
            className="group inline-flex items-center gap-2.5 rounded-full border border-blue-200/50 bg-white/60 px-5 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-blue-300 hover:bg-white/80 hover:shadow-md"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
              <Sparkles size={10} className="text-white" />
            </span>
            Introducing Teskel Agent v2.0
            <ArrowRight size={14} className="text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600" />
          </Link>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-center md:text-left"
        >
          <h1 className="max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-gray-900 md:text-7xl">
            The AI-native{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                code editor
              </span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-1 left-0 h-3 w-full origin-left bg-blue-100/60 md:-bottom-2 md:h-4"
              />
            </span>{" "}
            that writes code for you.
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 max-w-2xl text-center text-lg leading-relaxed text-gray-500 md:text-left md:text-xl"
        >
          Teskel combines frontier AI models with a world-class editor to help you write, refactor, and ship code{" "}
          <span className="font-medium text-gray-700">10x faster</span>.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row md:items-start"
        >
          <Link
            href="/download"
            className="btn-press group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-gray-900/10 transition-all duration-300 hover:shadow-2xl hover:shadow-gray-900/20"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Download size={18} className="relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5" />
            <span className="relative z-10">Download for free</span>
          </Link>
          <Link
            href="/enterprise"
            className="btn-press group inline-flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white/80 px-8 py-4 text-base font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-gray-300 hover:bg-white hover:shadow-lg"
          >
            Request a demo
            <ArrowRight size={18} className="text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-600" />
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 flex flex-wrap justify-center gap-8 md:justify-start md:gap-12"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50/80 backdrop-blur-sm">
                <stat.icon size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Editor Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 5 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ rotateX, rotateY, transformPerspective: 1200 }}
          className="mt-20 overflow-hidden rounded-2xl border border-gray-200/60 bg-[#0B0F19] shadow-2xl shadow-gray-900/20"
        >
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-gray-800 bg-[#0D1117] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs font-medium text-gray-500">Teskel — main.tsx</span>
            <div className="w-12" />
          </div>
          {/* Code content */}
          <div className="p-6 font-mono text-sm leading-7">
            <div><span className="text-purple-400">import</span> <span className="text-blue-300">{"{ useState }"}</span> <span className="text-purple-400">from</span> <span className="text-green-300">&quot;react&quot;</span></div>
            <div><span className="text-purple-400">import</span> <span className="text-blue-300">{"{ motion }"}</span> <span className="text-purple-400">from</span> <span className="text-green-300">&quot;framer-motion&quot;</span></div>
            <div className="mt-2"><span className="text-purple-400">export default function</span> <span className="text-yellow-300">App</span><span className="text-gray-400">()</span> <span className="text-gray-400">{"{"}</span></div>
            <div className="ml-4"><span className="text-purple-400">const</span> [<span className="text-blue-300">count</span>, <span className="text-blue-300">setCount</span>] = <span className="text-yellow-300">useState</span>(<span className="text-orange-300">0</span>)</div>
            <div className="mt-2 ml-4"><span className="text-purple-400">return</span> (</div>
            <div className="ml-8 text-gray-500/60">{"// Teskel: generating optimized component..."}</div>
            <div className="ml-8 flex items-center gap-2">
              <span className="text-gray-400">&lt;</span><span className="text-blue-300">motion.div</span>
              <span className="animate-pulse-soft rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">AI completing...</span>
            </div>
            <div className="ml-8 text-gray-400">)</div>
            <div className="text-gray-400">{"}"}</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
