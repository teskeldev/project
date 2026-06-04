"use client";

import { motion } from "framer-motion";
import { Download, Monitor, Apple, Terminal } from "lucide-react";

const platforms = [
  {
    icon: Monitor,
    name: "Windows",
    description: "Windows 10+ (64-bit)",
    filename: "Teskel-Setup-1.0.0.exe",
    primary: true,
  },
  {
    icon: Apple,
    name: "macOS",
    description: "macOS 12+ (Apple Silicon & Intel)",
    filename: "Teskel-1.0.0-universal.dmg",
    primary: false,
  },
  {
    icon: Terminal,
    name: "Linux",
    description: "Ubuntu 20.04+, Fedora 36+, Arch",
    filename: "teskel-1.0.0.AppImage",
    primary: false,
  },
];

export default function DownloadPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Download Teskel
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-600">
            Available on all major platforms. Free to use, with optional Pro
            upgrade.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-gray-200/80 bg-white/80 p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                <platform.icon size={32} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {platform.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {platform.description}
              </p>
              <button
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  platform.primary
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Download size={16} />
                Download
              </button>
              <p className="mt-2 text-xs text-gray-400">{platform.filename}</p>
            </motion.div>
          ))}
        </div>

        {/* CLI */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 rounded-2xl border border-gray-200/80 bg-white/80 p-8"
        >
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Install via CLI
          </h3>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">npm</p>
              <div className="rounded-lg bg-gray-900 px-4 py-3 font-mono text-sm text-gray-300">
                npm install -g @teskel/cli
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">curl</p>
              <div className="rounded-lg bg-gray-900 px-4 py-3 font-mono text-sm text-gray-300">
                curl -fsSL https://teskel.dev/install.sh | sh
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">
                Homebrew
              </p>
              <div className="rounded-lg bg-gray-900 px-4 py-3 font-mono text-sm text-gray-300">
                brew install teskel
              </div>
            </div>
          </div>
        </motion.div>

        {/* System requirements */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 rounded-2xl border border-gray-200/80 bg-white/80 p-8"
        >
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            System requirements
          </h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Minimum</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>4 GB RAM</li>
                <li>2 GB disk space</li>
                <li>64-bit OS</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Recommended</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>8 GB RAM</li>
                <li>4 GB disk space</li>
                <li>SSD storage</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Supported OS</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>Windows 10+</li>
                <li>macOS 12+</li>
                <li>Ubuntu 20.04+</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
