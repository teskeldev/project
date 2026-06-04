"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Book,
  Code2,
  Terminal,
  Zap,
  Settings,
  Key,
  Puzzle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

const categories = [
  {
    icon: Book,
    title: "Getting Started",
    description: "Installation, setup, and your first project",
    articles: [
      "Quick start guide",
      "Installation",
      "Editor overview",
      "Your first AI completion",
    ],
  },
  {
    icon: Code2,
    title: "Editor Features",
    description: "Code editing, navigation, and productivity",
    articles: [
      "Tab completions",
      "Multi-cursor editing",
      "Code folding",
      "Snippets & templates",
    ],
  },
  {
    icon: Zap,
    title: "AI Features",
    description: "Chat, agent, and AI-powered workflows",
    articles: [
      "AI Chat",
      "Agent mode",
      "Code generation",
      "Inline editing with Ctrl+K",
    ],
  },
  {
    icon: Terminal,
    title: "Terminal & CLI",
    description: "Integrated terminal and command line tools",
    articles: [
      "Terminal basics",
      "Shell integration",
      "Teskel CLI commands",
      "Custom tasks",
    ],
  },
  {
    icon: Settings,
    title: "Configuration",
    description: "Settings, keybindings, and customization",
    articles: [
      "Settings reference",
      "Keyboard shortcuts",
      "Themes & colors",
      "Extension support",
    ],
  },
  {
    icon: Key,
    title: "Authentication & API",
    description: "API keys, OAuth, and integrations",
    articles: [
      "API key management",
      "REST API reference",
      "Webhooks",
      "Rate limits",
    ],
  },
  {
    icon: Puzzle,
    title: "Extensions",
    description: "Marketplace, plugins, and custom extensions",
    articles: [
      "Extension marketplace",
      "Creating extensions",
      "Extension API",
      "Publishing guide",
    ],
  },
];

const popularArticles = [
  "How to get the most out of Tab completions",
  "Configuring AI models for your workspace",
  "Setting up team workspaces",
  "Migrating from VS Code",
  "Keyboard shortcuts cheat sheet",
];

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Documentation
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-600">
            Everything you need to know about Teskel
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
              /
            </kbd>
          </div>
        </motion.div>

        {/* Popular articles */}
        <div className="mb-16">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Popular articles
          </h2>
          <div className="flex flex-wrap gap-2">
            {popularArticles.map((article) => (
              <button
                key={article}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600"
              >
                {article}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="mb-3 inline-flex rounded-lg bg-blue-50 p-2.5">
                <cat.icon size={20} className="text-blue-600" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-gray-900">
                {cat.title}
              </h3>
              <p className="mb-4 text-sm text-gray-500">{cat.description}</p>
              <ul className="space-y-2">
                {cat.articles.map((article) => (
                  <li key={article}>
                    <button className="flex w-full items-center justify-between text-left text-sm text-gray-600 transition-colors hover:text-blue-600">
                      <span>{article}</span>
                      <ArrowRight
                        size={14}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Help section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 rounded-2xl bg-gray-900 p-12 text-center"
        >
          <h2 className="text-2xl font-semibold text-white">
            Can&apos;t find what you need?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Join our community forum or contact support. We&apos;re here to help.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100">
              <ExternalLink size={16} />
              Community Forum
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800">
              Contact Support
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
