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
import Link from "next/link";
import { Button, Card, CardTitle, CardDescription, Input } from "@/components/ui";

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
  { title: "How to get the most out of Tab completions", slug: "tab-completions-tips" },
  { title: "Configuring AI models for your workspace", slug: "ai-model-config" },
  { title: "Setting up team workspaces", slug: "team-workspaces" },
  { title: "Migrating from VS Code", slug: "migrate-vscode" },
  { title: "Keyboard shortcuts cheat sheet", slug: "keyboard-shortcuts" },
];

function articleSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Documentation
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-text-secondary">
            Everything you need to know about Teskel
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
            <Search size={20} className="text-text-muted" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation..."
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <kbd className="rounded border border-border bg-surface-soft px-2 py-0.5 text-xs text-text-muted">
              /
            </kbd>
          </div>
        </motion.div>

        {/* Popular articles */}
        <div className="mb-16">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Popular articles
          </h2>
          <div className="flex flex-wrap gap-2">
            {popularArticles.map((article) => (
              <Button
                key={article.slug}
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={`/docs/${article.slug}`}>
                  {article.title}
                </Link>
              </Button>
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
            >
              <Card className="group h-full rounded-2xl p-6 transition-all duration-300 hover:border-accent hover:shadow-lg">
                <div className="mb-3 inline-flex rounded-lg bg-accent-light p-2.5">
                  <cat.icon size={20} className="text-accent" />
                </div>
                <CardTitle className="mb-1 text-base">
                  {cat.title}
                </CardTitle>
                <CardDescription className="mb-4">
                  {cat.description}
                </CardDescription>
                <ul className="space-y-2">
                  {cat.articles.map((article) => (
                    <li key={article}>
                      <Link
                        href={`/docs/${articleSlug(article)}`}
                        className="flex w-full items-center justify-between text-left text-sm text-text-secondary transition-colors hover:text-accent"
                      >
                        <span>{article}</span>
                        <ArrowRight
                          size={14}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Help section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 rounded-2xl bg-primary p-12 text-center"
        >
          <h2 className="text-2xl font-semibold text-background">
            Can&apos;t find what you need?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
            Join our community forum or contact support. We&apos;re here to help.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button
              variant="secondary"
              className="bg-background text-foreground hover:bg-surface-soft"
              asChild
            >
              <Link href="https://community.teskel.dev">
                <ExternalLink size={16} />
                Community Forum
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-border/40 text-background hover:bg-primary-hover"
              asChild
            >
              <Link href="/support">
                Contact Support
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
