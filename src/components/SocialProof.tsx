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
    <section className="overflow-hidden px-6 py-20">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="mb-12 text-center text-sm font-medium tracking-wide text-gray-500"
      >
        Trusted every day by teams that build world-class software
      </motion.p>

      {/* Marquee */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#fff5f5] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#fff5f5] to-transparent" />

        <div className="flex animate-marquee items-center gap-16">
          {[...companies, ...companies].map((company, i) => (
            <div
              key={`${company}-${i}`}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/60 px-8 py-5 backdrop-blur-sm"
            >
              <span className="text-xl font-bold tracking-tight text-gray-800">
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
