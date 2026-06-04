"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const tabs = [
  { name: "main.tsx", active: true },
  { name: "api.ts", active: false },
  { name: "config.ts", active: false },
];

const files = [
  { name: "src", type: "folder", indent: 0 },
  { name: "components", type: "folder", indent: 1 },
  { name: "main.tsx", type: "file", indent: 1, active: true },
  { name: "api.ts", type: "file", indent: 1 },
  { name: "config.ts", type: "file", indent: 1 },
  { name: "package.json", type: "file", indent: 0 },
  { name: "tsconfig.json", type: "file", indent: 0 },
];

const codeLines = [
  { num: 1, tokens: [{ text: "import", c: "text-purple-400" }, { text: " { createApp } ", c: "text-blue-300" }, { text: "from", c: "text-purple-400" }, { text: " \"@teskel/core\"", c: "text-green-400" }] },
  { num: 2, tokens: [{ text: "import", c: "text-purple-400" }, { text: " { Agent } ", c: "text-blue-300" }, { text: "from", c: "text-purple-400" }, { text: " \"@teskel/agent\"", c: "text-green-400" }] },
  { num: 3, tokens: [] },
  { num: 4, tokens: [{ text: "const", c: "text-purple-400" }, { text: " app ", c: "text-blue-300" }, { text: "= ", c: "text-gray-400" }, { text: "createApp", c: "text-yellow-300" }, { text: "({", c: "text-gray-400" }] },
  { num: 5, tokens: [{ text: "  name: ", c: "text-gray-400" }, { text: "\"my-project\"", c: "text-green-400" }, { text: ",", c: "text-gray-400" }] },
  { num: 6, tokens: [{ text: "  model: ", c: "text-gray-400" }, { text: "\"gpt-4o\"", c: "text-green-400" }, { text: ",", c: "text-gray-400" }] },
  { num: 7, tokens: [{ text: "})", c: "text-gray-400" }] },
  { num: 8, tokens: [] },
  { num: 9, tokens: [{ text: "const", c: "text-purple-400" }, { text: " agent ", c: "text-blue-300" }, { text: "= ", c: "text-gray-400" }, { text: "new ", c: "text-purple-400" }, { text: "Agent", c: "text-yellow-300" }, { text: "({", c: "text-gray-400" }] },
  { num: 10, tokens: [{ text: "  tools: ", c: "text-gray-400" }, { text: "[", c: "text-gray-400" }, { text: "\"code\"", c: "text-green-400" }, { text: ", ", c: "text-gray-400" }, { text: "\"terminal\"", c: "text-green-400" }, { text: ", ", c: "text-gray-400" }, { text: "\"browser\"", c: "text-green-400" }, { text: "]", c: "text-gray-400" }, { text: ",", c: "text-gray-400" }] },
  { num: 11, tokens: [{ text: "  context: ", c: "text-gray-400" }, { text: "app", c: "text-blue-300" }, { text: ",", c: "text-gray-400" }] },
  { num: 12, tokens: [{ text: "})", c: "text-gray-400" }] },
  { num: 13, tokens: [] },
  { num: 14, tokens: [{ text: "// Teskel generates & ships your feature", c: "text-gray-600" }] },
  { num: 15, tokens: [{ text: "await", c: "text-purple-400" }, { text: " agent", c: "text-blue-300" }, { text: ".", c: "text-gray-400" }, { text: "run", c: "text-yellow-300" }, { text: "(", c: "text-gray-400" }, { text: "\"Add auth with OAuth + email\"", c: "text-green-400" }, { text: ")", c: "text-gray-400" }] },
];

export default function EditorDemo() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="mb-6 text-center"
        >
          <p className="text-sm font-medium text-blue-600">See it in action</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Your AI pair programmer
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-2xl border border-gray-800/80 bg-[#0B0F19] shadow-2xl shadow-black/40"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-gray-800 bg-[#0D1117] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57] transition-opacity hover:opacity-80" />
              <div className="h-3 w-3 rounded-full bg-[#FEBC2E] transition-opacity hover:opacity-80" />
              <div className="h-3 w-3 rounded-full bg-[#28C840] transition-opacity hover:opacity-80" />
            </div>
            <span className="text-xs font-medium text-gray-500">Teskel Editor</span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Agent Active</span>
            </div>
          </div>

          <div className="flex">
            {/* File explorer */}
            <div className="hidden w-48 border-r border-gray-800 bg-[#0D1117] py-2 md:block">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Explorer</p>
              {files.map((f, i) => (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className={`flex items-center gap-2 px-3 py-1 text-xs transition-colors hover:bg-white/5 ${
                    f.active ? "bg-white/5 text-white" : "text-gray-500"
                  }`}
                  style={{ paddingLeft: `${12 + f.indent * 12}px` }}
                >
                  <span className={f.type === "folder" ? "text-blue-400" : "text-gray-500"}>
                    {f.type === "folder" ? "📁" : "📄"}
                  </span>
                  {f.name}
                </motion.div>
              ))}
            </div>

            {/* Main editor area */}
            <div className="flex-1">
              {/* Tabs */}
              <div className="flex border-b border-gray-800 bg-[#0D1117]">
                {tabs.map((tab, i) => (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(i)}
                    className={`flex items-center gap-2 border-r border-gray-800 px-4 py-2 text-xs transition-all duration-200 ${
                      i === activeTab
                        ? "border-t-2 border-t-blue-500 bg-[#0B0F19] text-white"
                        : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                    }`}
                  >
                    {tab.name}
                    {i === activeTab && <span className="text-gray-600">&times;</span>}
                  </button>
                ))}
              </div>

              {/* Code area */}
              <div className="relative p-5 font-mono text-[13px] leading-7">
                {/* AI suggestion overlay */}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 1.2 }}
                  viewport={{ once: true }}
                  className="absolute right-6 top-6 z-10 rounded-lg border border-blue-500/20 bg-blue-950/50 px-3 py-2 backdrop-blur-sm"
                >
                  <p className="text-[10px] font-medium text-blue-400">Teskel AI</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">Generating auth module...</p>
                  <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-gray-800">
                    <motion.div
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                    />
                  </div>
                </motion.div>

                {codeLines.map((line, i) => (
                  <motion.div
                    key={line.num}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + i * 0.04 }}
                    viewport={{ once: true }}
                    className="flex hover:bg-white/[0.02]"
                  >
                    <span className="mr-6 w-5 select-none text-right text-gray-700">
                      {line.num}
                    </span>
                    <span>
                      {line.tokens.map((token, j) => (
                        <span key={j} className={token.c}>{token.text}</span>
                      ))}
                    </span>
                  </motion.div>
                ))}

                {/* Cursor blink */}
                <div className="mt-1 flex">
                  <span className="mr-6 w-5 select-none text-right text-gray-700">16</span>
                  <span className="animate-pulse-soft h-5 w-[2px] bg-blue-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-gray-800 bg-[#0D1117] px-4 py-1.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Connected
              </span>
              <span className="text-[10px] text-gray-600">TypeScript</span>
              <span className="text-[10px] text-gray-600">UTF-8</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-600">Ln 15, Col 52</span>
              <span className="text-[10px] text-gray-600">Spaces: 2</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
