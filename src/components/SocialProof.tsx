"use client";

import { motion } from "framer-motion";

const companies = [
  "Stripe",
  "OpenAI",
  "Linear",
  "Datadog",
  "NVIDIA",
  "Figma",
  "Ramp",
  "Adobe",
  "Vercel",
  "Shopify",
];

export default function SocialProof() {
  return (
    <section className="overflow-hidden px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <p className="text-sm font-medium tracking-wide text-gray-400">
          TRUSTED BY ENGINEERS AT
        </p>
      </motion.div>

      {/* Marquee */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-[#F7F7F5] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-[#F7F7F5] to-transparent" />

        <div className="flex animate-marquee items-center gap-12">
          {[...companies, ...companies].map((company, i) => (
            <div
              key={`${company}-${i}`}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200/50 bg-white/60 px-10 py-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-gray-300/80 hover:bg-white/90 hover:shadow-md"
            >
              <span className="text-xl font-bold tracking-tight text-gray-700/80 transition-colors duration-300 hover:text-gray-900">
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
