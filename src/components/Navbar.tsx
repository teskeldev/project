"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/docs" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 w-full border-b border-[#E5E7EB]/60 bg-white/70 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              className="text-gray-900 transition-transform duration-300 group-hover:scale-110"
            >
              <rect width="28" height="28" rx="6" fill="currentColor" />
              <path
                d="M8 8h4v12H8V8zm8 0h4v12h-4V8z"
                fill="white"
              />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            TESKEL
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-blue-500 after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
          >
            Sign in
          </Link>
          <Link
            href="/enterprise"
            className="btn-press rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
          >
            Contact sales
          </Link>
          <Link
            href="/download"
            className="btn-press relative overflow-hidden rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-md"
          >
            Download
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <motion.div
            animate={{ rotate: mobileOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.div>
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
            className="overflow-hidden border-t border-[#E5E7EB]/60 bg-white/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-4">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className="block text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <hr className="border-[#E5E7EB]" />
              <Link href="/login" className="text-sm font-medium text-gray-600">
                Sign in
              </Link>
              <Link
                href="/enterprise"
                className="rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700"
              >
                Contact sales
              </Link>
              <Link
                href="/download"
                className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Download
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
