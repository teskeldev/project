"use client";

import { motion } from "framer-motion";
import { Download, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative px-6 py-32">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          viewport={{ once: true }}
          className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl"
        >
          Ready to build{" "}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            faster
          </span>
          ?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="mx-auto mt-4 max-w-lg text-lg text-gray-500"
        >
          Join thousands of developers who ship with Teskel every day.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/download"
            className="btn-press group inline-flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-4 text-lg font-medium text-white shadow-lg shadow-gray-900/10 transition-all duration-300 hover:bg-gray-800 hover:shadow-xl hover:shadow-gray-900/20"
          >
            <Download size={20} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
            Download for free
          </Link>
          <Link
            href="/docs"
            className="btn-press group inline-flex items-center gap-2 text-base font-medium text-gray-600 transition-all duration-200 hover:text-gray-900"
          >
            View documentation
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
