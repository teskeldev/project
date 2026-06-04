"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-24 md:pb-32 md:pt-36">
      {/* Subtle gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-slate-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-start"
        >
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-gray-900 md:text-6xl md:leading-[1.15]">
            Built to make you extraordinarily productive,{" "}
            <span className="text-blue-600">Teskel</span> is the best coding
            agent.
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/download"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-base font-medium text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl"
          >
            <Download size={18} />
            Download for free
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            Request a demo
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
