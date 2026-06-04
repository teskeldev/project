"use client";

import { motion } from "framer-motion";

function WindowDot({ color }: { color: string }) {
  return <div className={`h-3 w-3 rounded-full ${color}`} />;
}

function EditorTab({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-r border-gray-700 px-4 py-2 text-xs ${
        active
          ? "bg-gray-800 text-white"
          : "text-gray-400 hover:text-gray-300"
      }`}
    >
      {label}
      {active && <span className="text-gray-500">&times;</span>}
    </div>
  );
}

const codeLines = [
  { indent: 0, content: '"use client";', color: "text-green-400" },
  { indent: 0, content: "", color: "" },
  {
    indent: 0,
    content: 'import React, { useState } from "react";',
    color: "text-purple-400",
  },
  {
    indent: 0,
    content: 'import Navigation from "./Navigation";',
    color: "text-purple-400",
  },
  {
    indent: 0,
    content: 'import SupportChat from "./SupportChat";',
    color: "text-purple-400",
  },
  { indent: 0, content: "", color: "" },
  {
    indent: 0,
    content: "export default function Dashboard() {",
    color: "text-blue-400",
  },
  {
    indent: 1,
    content: 'const [activeTab, setActiveTab] = useState("support");',
    color: "text-yellow-300",
  },
  { indent: 0, content: "", color: "" },
  { indent: 1, content: "return (", color: "text-gray-300" },
  {
    indent: 2,
    content:
      '<div className="flex h-[600px] border rounded-lg overflow-hidden">',
    color: "text-gray-300",
  },
  {
    indent: 3,
    content: '<div className="w-64 border-r">',
    color: "text-gray-300",
  },
  {
    indent: 4,
    content: "<Navigation />",
    color: "text-blue-400",
  },
  { indent: 3, content: "</div>", color: "text-gray-300" },
  {
    indent: 3,
    content: '<div className="w-80 border-l">',
    color: "text-gray-300",
  },
  {
    indent: 4,
    content: "<SupportChat />",
    color: "text-blue-400",
  },
  { indent: 3, content: "</div>", color: "text-gray-300" },
  { indent: 2, content: "</div>", color: "text-gray-300" },
  { indent: 1, content: ");", color: "text-gray-300" },
  { indent: 0, content: "}", color: "text-blue-400" },
];

export default function EditorDemo() {
  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <WindowDot color="bg-red-500" />
              <WindowDot color="bg-yellow-500" />
              <WindowDot color="bg-green-500" />
            </div>
            <span className="text-sm font-medium text-gray-400">Teskel</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Get Teskel</span>
              <span className="text-gray-600">&#8943;</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-gray-850">
            <EditorTab label="Dashboard.tsx" active />
            <EditorTab label="SupportChat.tsx" />
          </div>

          {/* Code area */}
          <div className="relative p-6 font-mono text-sm leading-relaxed">
            {/* Tab tooltip */}
            <div className="absolute right-32 top-44 z-10 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 shadow-lg">
              <span className="text-blue-400">Tab</span> to jump here
            </div>

            {codeLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                viewport={{ once: true }}
                className="flex"
              >
                <span className="mr-4 w-6 select-none text-right text-gray-600">
                  {i + 1}
                </span>
                <span className={line.color}>
                  {"  ".repeat(line.indent)}
                  {line.content}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
