"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "How does Teskel read my entire codebase?",
    answer: "Teskel utilizes a proprietary local AST scanner combined with ultra-fast vector embeddings. When you connect a repository, it builds a structural map of your code in milliseconds, allowing the AI to understand cross-file dependencies and logic flows instantly without sending your entire codebase to the cloud."
  },
  {
    question: "Do you train models on my private code?",
    answer: "Absolutely not. We have a strict zero-retention policy. Your private code is only used as temporary context for the frontier models (like Claude 3.5 or GPT-4o) during the exact moment of inference, and is immediately discarded."
  },
  {
    question: "Can Teskel execute code or just suggest it?",
    answer: "Both. In Agent Mode, Teskel can spin up secure micro-VMs to test its own code, run your test suite, and ensure the proposed changes actually compile and work before presenting them to you."
  },
  {
    question: "How is this different from GitHub Copilot?",
    answer: "Copilot is an autocomplete engine that looks at the file you currently have open. Teskel is a spatial reasoning engine. It can plan multi-file refactors, understand database schema changes spanning 10 different files, and autonomously write pull requests while you focus on architecture."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="px-6 py-24 md:py-32 bg-[#F7F7F5]">
      <div className="mx-auto max-w-[800px]">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[2.5rem] font-semibold tracking-tighter text-slate-900 md:text-[3.5rem]"
          >
            Engineering Intelligence. <br/> Answered.
          </motion.h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-black/[0.04] bg-white/60 p-2 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="text-[16px] font-medium text-slate-900">{faq.question}</span>
                <span className="ml-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <motion.svg 
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </motion.svg>
                </span>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 text-[15px] leading-relaxed text-slate-500">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
