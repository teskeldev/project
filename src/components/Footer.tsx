"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Agents", href: "/#product" },
      { label: "Teams", href: "/enterprise" },
      { label: "Enterprise", href: "/enterprise" },
      { label: "Pricing", href: "/pricing" },
      { label: "Code Review", href: "/#product" },
      { label: "Tab", href: "/#product" },
      { label: "CLI", href: "/download" },
      { label: "Cloud Agents", href: "/#product" },
      { label: "Marketplace", href: "/docs" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Download", href: "/download" },
      { label: "Changelog", href: "/changelog" },
      { label: "Docs", href: "/docs" },
      { label: "Learn", href: "/docs" },
      { label: "Forum", href: "#" },
      { label: "Help", href: "#" },
      { label: "Workshops", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Careers", href: "#" },
      { label: "Blog", href: "/blog" },
      { label: "Community", href: "#" },
      { label: "Students", href: "#" },
      { label: "Brand", href: "#" },
      { label: "Future", href: "#" },
      { label: "Teskel Labs", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Data Use", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "X", href: "#" },
      { label: "LinkedIn", href: "#" },
      { label: "YouTube", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[#E5E7EB]/60 bg-white/50 px-6 py-20 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl">
        {/* Top: Logo + description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 flex flex-col items-start gap-4"
        >
          <Link href="/" className="inline-flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="text-gray-900">
              <rect width="28" height="28" rx="6" fill="currentColor" />
              <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
            </svg>
            <span className="text-lg font-bold tracking-tight text-gray-900">TESKEL</span>
          </Link>
          <p className="max-w-xs text-sm text-gray-500">
            The AI-native code editor that writes code for you. Built for speed.
          </p>
        </motion.div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
          {footerColumns.map((col, colIdx) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: colIdx * 0.05 }}
              viewport={{ once: true }}
            >
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-all duration-200 hover:translate-x-0.5 hover:text-gray-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-gray-200/60 pt-8 sm:flex-row">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Teskel, Inc.
            </span>
            <span className="text-xs text-gray-400">&bull; SOC 2 Certified</span>
          </div>

          {/* Theme toggles */}
          <div className="flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/80 px-2 py-1 backdrop-blur-sm">
            <button
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:text-gray-600"
              aria-label="System theme"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </button>
            <button
              className="rounded-full bg-gray-100 p-1.5 text-gray-800"
              aria-label="Light theme"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <button
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Dark theme"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            English
          </div>
        </div>
      </div>
    </footer>
  );
}
