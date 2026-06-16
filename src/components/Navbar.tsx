"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`fixed top-0 z-50 w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        scrolled 
          ? "bg-white/60 backdrop-blur-xl border-b border-gray-200/30 shadow-[0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(0,0,0,0.03)]" 
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
        {/* Branding */}
        <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 overflow-hidden">
             <motion.div 
               className="absolute inset-0 bg-white/20"
               initial={{ x: "-100%" }}
               whileHover={{ x: "100%" }}
               transition={{ duration: 0.5, ease: "easeInOut" }}
             />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M4 4h16v16H4V4zm8 0h4v16h-4V4z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[17px] font-bold tracking-tight text-slate-900">Teskel</span>
        </Link>

        {/* Hyper-Focused Funnel Links */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-[14px] font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900">Features</Link>
          <Link href="/pricing" className="text-[14px] font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900">Pricing</Link>
          <Link href="/docs" className="text-[14px] font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900">Docs</Link>
        </div>

        {/* Action Group */}
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/login" className="text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-900">
            Log in
          </Link>
          
          <Link href="/signup" className="group relative overflow-hidden rounded-full bg-blue-600 px-5 py-2 text-[13px] font-medium text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-600/20">
            {/* Liquid Gradient Sweep */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full" />
            <span className="relative flex items-center gap-1.5">
              Get Started <span className="transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
            </span>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="text-slate-600 md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-gray-100 bg-white/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              <Link href="/#features" className="text-[15px] font-medium text-slate-600" onClick={() => setMobileOpen(false)}>Features</Link>
              <Link href="/pricing" className="text-[15px] font-medium text-slate-600" onClick={() => setMobileOpen(false)}>Pricing</Link>
              <hr className="my-2 border-gray-100" />
              <Link href="/login" className="text-[15px] font-medium text-slate-600" onClick={() => setMobileOpen(false)}>Log in</Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)} className="mt-2 block w-full rounded-full bg-blue-600 px-5 py-2.5 text-center text-[14px] font-medium text-white shadow-md">
                Get Started for Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
