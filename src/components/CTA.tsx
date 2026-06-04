"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/4 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 translate-x-1/2 rounded-full bg-gradient-to-bl from-slate-100 to-blue-50 blur-3xl"
        />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold tracking-tight text-gray-900 md:text-6xl"
          >
            Ready to build{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                10x faster
              </span>
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="absolute -bottom-1 left-0 h-3 w-full origin-left bg-blue-100/70 md:-bottom-2 md:h-4"
              />
            </span>
            ?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            viewport={{ once: true }}
            className="mx-auto mt-6 max-w-xl text-lg text-gray-500"
          >
            Join 200,000+ developers who use Teskel to write better code,
            ship faster, and build the future.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/download"
              className="btn-press group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-gray-900/10 transition-all duration-300 hover:shadow-2xl hover:shadow-gray-900/20"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <Download size={18} className="relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span className="relative z-10">Download Teskel</span>
            </Link>
            <Link
              href="/pricing"
              className="btn-press group inline-flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white/80 px-8 py-4 text-base font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-gray-300 hover:bg-white hover:shadow-lg"
            >
              View pricing
              <ArrowRight size={18} className="text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-600" />
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
            className="mt-14 flex items-center justify-center gap-6"
          >
            <div className="flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-gray-200 to-gray-300 shadow-sm"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">Loved by 200K+ developers</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
