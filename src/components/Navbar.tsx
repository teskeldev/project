"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/docs" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB]/60 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="text-[#0F172A]">
            <rect width="28" height="28" rx="6" fill="currentColor" />
            <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
          </svg>
          <span className="text-[16px] font-bold tracking-tight text-[#0F172A]">Teskel</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[14px] text-[#64748B] transition-colors hover:text-[#0F172A]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-[14px] text-[#64748B] transition-colors hover:text-[#0F172A]">
            Sign in
          </Link>
          <Link
            href="/enterprise"
            className="rounded-full border border-[#E5E7EB] px-4 py-1.5 text-[13px] font-medium text-[#0F172A] transition-all hover:border-[#D1D5DB] hover:shadow-sm"
          >
            Contact sales
          </Link>
          <Link
            href="/download"
            className="rounded-full bg-[#0F172A] px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1E293B]"
          >
            Download
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#E5E7EB]/60 bg-white md:hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] text-[#64748B] hover:text-[#0F172A]"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-[#E5E7EB]" />
              <Link href="/login" className="text-[14px] text-[#64748B]">Sign in</Link>
              <Link href="/enterprise" className="rounded-full border border-[#E5E7EB] px-4 py-2 text-center text-[13px] font-medium text-[#0F172A]">
                Contact sales
              </Link>
              <Link href="/download" className="rounded-full bg-[#0F172A] px-4 py-2 text-center text-[13px] font-medium text-white">
                Download
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
