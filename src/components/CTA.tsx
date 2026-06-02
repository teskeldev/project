"use client";

import { motion } from "framer-motion";
import { Download } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="px-6 py-28">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
          Try Teskel now.
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-10 flex justify-center"
        >
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-4 text-lg font-medium text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl"
          >
            <Download size={20} />
            Download for free
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
