"use client";

import { motion } from "framer-motion";
import { Tag } from "lucide-react";

const releases = [
  {
    version: "1.5.0",
    date: "May 28, 2026",
    title: "Agent 2.0 & Multi-file Editing",
    changes: [
      { type: "feature", text: "New Agent 2.0 with multi-file editing support" },
      { type: "feature", text: "Plan Mission Control for complex task management" },
      { type: "improvement", text: "50% faster Tab completions" },
      { type: "improvement", text: "Improved context window (up to 200k tokens)" },
      { type: "fix", text: "Fixed memory leak in large projects" },
    ],
  },
  {
    version: "1.4.0",
    date: "May 15, 2026",
    title: "Terminal Integration & CLI",
    changes: [
      { type: "feature", text: "Integrated terminal with shell detection" },
      { type: "feature", text: "Teskel CLI for command-line workflows" },
      { type: "feature", text: "Custom task runner support" },
      { type: "improvement", text: "Better Python and Rust language support" },
      { type: "fix", text: "Fixed SSH remote connection timeout" },
    ],
  },
  {
    version: "1.3.0",
    date: "May 1, 2026",
    title: "Team Workspaces & SSO",
    changes: [
      { type: "feature", text: "Team workspace with shared settings" },
      { type: "feature", text: "SSO & SAML authentication" },
      { type: "feature", text: "Admin dashboard for usage analytics" },
      { type: "improvement", text: "Faster startup time (2x improvement)" },
      { type: "fix", text: "Fixed Git integration with SSH keys" },
      { type: "fix", text: "Fixed cursor jumping in JSX files" },
    ],
  },
  {
    version: "1.2.0",
    date: "Apr 15, 2026",
    title: "Code Review & Git Integration",
    changes: [
      { type: "feature", text: "Inline code review with AI suggestions" },
      { type: "feature", text: "Native Git integration (commit, push, branch)" },
      { type: "improvement", text: "Improved diff viewer" },
      { type: "fix", text: "Fixed autocomplete in markdown files" },
    ],
  },
  {
    version: "1.1.0",
    date: "Apr 1, 2026",
    title: "AI Chat Improvements",
    changes: [
      { type: "feature", text: "Chat with codebase context (@file mentions)" },
      { type: "feature", text: "Inline editing with Ctrl+K" },
      { type: "improvement", text: "Better TypeScript type inference" },
      { type: "improvement", text: "Reduced API latency by 30%" },
      { type: "fix", text: "Fixed extension compatibility issues" },
    ],
  },
];

const typeColors: Record<string, string> = {
  feature: "bg-green-100 text-green-700",
  improvement: "bg-blue-100 text-blue-700",
  fix: "bg-amber-100 text-amber-700",
};

export default function ChangelogPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Changelog
          </h1>
          <p className="mt-4 text-base text-gray-600">
            New features, improvements, and fixes in every release.
          </p>
        </motion.div>

        <div className="space-y-12">
          {releases.map((release, i) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="relative border-l-2 border-gray-200 pl-8"
            >
              {/* Dot */}
              <div className="absolute -left-2 top-0 h-4 w-4 rounded-full border-2 border-rose-500 bg-white" />

              <div className="mb-2 flex items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-0.5 text-sm font-medium text-rose-700">
                  <Tag size={12} />
                  v{release.version}
                </span>
                <span className="text-sm text-gray-500">{release.date}</span>
              </div>

              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                {release.title}
              </h3>

              <ul className="space-y-2">
                {release.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase ${typeColors[change.type]}`}
                    >
                      {change.type}
                    </span>
                    <span className="text-sm text-gray-600">
                      {change.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
