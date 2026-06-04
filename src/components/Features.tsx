"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Terminal,
  GitBranch,
  Code2,
  MessageSquare,
  Layers,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Magically accurate autocomplete",
    description:
      "Our specialized Tab model predicts your next action with striking speed and precision. Just press Tab to accept.",
    link: "Learn about Tab",
    gradient: "from-amber-500 to-orange-600",
    bgGradient: "from-amber-50 to-orange-50",
  },
  {
    icon: Zap,
    title: "Lightning-fast Agent",
    description:
      "Teskel Agent can plan, search, and build entire features across your codebase. Give it a task and watch it work.",
    link: "Learn about Agent",
    gradient: "from-blue-500 to-indigo-600",
    bgGradient: "from-blue-50 to-indigo-50",
  },
  {
    icon: Terminal,
    title: "Inline terminal commands",
    description:
      "Run shell commands, install packages, and manage your dev environment without leaving the editor.",
    link: "Learn about Terminal",
    gradient: "from-emerald-500 to-teal-600",
    bgGradient: "from-emerald-50 to-teal-50",
  },
  {
    icon: GitBranch,
    title: "Git-native workflow",
    description:
      "Commit, push, branch, and resolve merge conflicts — all integrated directly into your editing experience.",
    link: "Learn about Git",
    gradient: "from-violet-500 to-purple-600",
    bgGradient: "from-violet-50 to-purple-50",
  },
];

const moreFeatures = [
  {
    icon: Code2,
    title: "Multi-file editing",
    description:
      "Edit across multiple files simultaneously with context-aware suggestions that understand your entire project.",
    gradient: "from-cyan-500 to-blue-600",
    bgGradient: "from-cyan-50 to-blue-50",
  },
  {
    icon: MessageSquare,
    title: "Chat with your codebase",
    description:
      "Ask questions, get explanations, and generate code in a conversational chat that knows your repo.",
    gradient: "from-pink-500 to-rose-600",
    bgGradient: "from-pink-50 to-rose-50",
  },
  {
    icon: Layers,
    title: "Plan Mission Control",
    description:
      "Break complex tasks into steps. Teskel tracks progress, shows diffs, and manages multiple workstreams.",
    gradient: "from-indigo-500 to-blue-600",
    bgGradient: "from-indigo-50 to-blue-50",
  },
  {
    icon: Shield,
    title: "Privacy & security first",
    description:
      "SOC 2 certified. Your code stays yours — with options for local-only mode and zero data retention.",
    gradient: "from-slate-500 to-gray-700",
    bgGradient: "from-slate-50 to-gray-50",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
  link,
  gradient,
  bgGradient,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  link?: string;
  gradient: string;
  bgGradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm transition-all duration-300 hover:border-gray-300/80 hover:shadow-xl"
    >
      {/* Hover gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 transition-opacity duration-500 group-hover:opacity-40`} />

      {/* Subtle top border gradient */}
      <div className={`absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      <div className="relative">
        <div className={`mb-5 inline-flex rounded-xl bg-gradient-to-br ${bgGradient} p-3.5 shadow-sm transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={22} className={`bg-gradient-to-br ${gradient} bg-clip-text text-blue-600`} />
        </div>
        <h3 className="mb-2.5 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm leading-relaxed text-gray-500">{description}</p>
        {link && (
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-all duration-200 group-hover:gap-2.5 group-hover:text-blue-700">
            {link}
            <motion.span
              className="inline-block"
              whileHover={{ x: 3 }}
            >
              &rarr;
            </motion.span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

function AgentDemo() {
  const tasks = [
    { label: "Build Landing Page", status: "Reading docs", progress: true },
    { label: "Analyze Tab vs Agent Usage", status: "Fetching data", progress: true },
    { label: "Plan Mission Control", status: "Generating plan", progress: true },
  ];

  const readyTasks = [
    { label: "PyTorch MNIST Experiment", time: "10m" },
    { label: "Set up Teskel Rules", time: "30m" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      className="mx-auto mt-20 max-w-5xl overflow-hidden rounded-2xl border border-gray-800/80 bg-[#0B0F19] shadow-2xl shadow-black/30"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#0D1117] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="text-xs font-medium text-gray-500">Teskel Agent</span>
        <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">Running</span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-72 border-r border-gray-800 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            In Progress
          </p>
          {tasks.map((task, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              viewport={{ once: true }}
              className="mb-2 flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
            >
              <div className="mt-1 h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-gray-200">{task.label}</p>
                <p className="text-xs text-gray-500">{task.status}</p>
              </div>
            </motion.div>
          ))}

          <p className="mb-3 mt-5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Ready for Review
          </p>
          {readyTasks.map((task, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
              viewport={{ once: true }}
              className="mb-2 flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
            >
              <div className="mt-1 h-4 w-4 rounded-full border-2 border-green-400" />
              <div className="flex flex-1 items-center justify-between">
                <p className="text-sm font-medium text-gray-200">{task.label}</p>
                <span className="text-xs text-gray-500">{task.time}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Build Landing Page</h3>
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm text-gray-300">
                make a landing page based on attached docs explaining what we do
              </p>
            </div>
          </div>

          {/* Browser preview */}
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 border-b border-gray-800 bg-[#0D1117] px-4 py-2">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-gray-700" />
                <div className="h-2 w-2 rounded-full bg-gray-700" />
                <div className="h-2 w-2 rounded-full bg-gray-700" />
              </div>
              <div className="flex-1 rounded-md bg-gray-800 px-3 py-1 text-center text-xs text-gray-500">
                http://localhost:3000
              </div>
            </div>
            <div className="bg-white p-6">
              <p className="font-serif text-lg font-medium text-gray-800">Acme Labs</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Software creation is changing. We are a group of researchers,
                engineers, and technologists inventing at the edge of
                what&apos;s useful and possible.
              </p>
              <button className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700">
                See projects &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AutocompleteDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      className="mx-auto mt-20 flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-center"
    >
      {/* Editor */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-800/80 bg-[#0B0F19] shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#0D1117] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <div className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <span className="text-xs font-medium text-gray-500">Teskel</span>
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Tab Active</span>
        </div>

        <div className="flex border-b border-gray-800">
          <div className="border-b-2 border-b-blue-500 border-r border-r-gray-800 bg-[#0B0F19] px-4 py-2 text-xs text-white">
            Dashboard.tsx
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 hover:text-gray-400">
            SupportChat.tsx
          </div>
        </div>

        <div className="p-5 font-mono text-[13px] leading-7">
          <div className="text-green-400">&quot;use client&quot;;</div>
          <div className="mt-2 text-purple-400">
            import React, {"{ useState }"} from &quot;react&quot;;
          </div>
          <div className="text-purple-400">
            import Navigation from &quot;./Navigation&quot;;
          </div>
          <div className="mt-2 text-blue-400">
            export default function Dashboard() {"{"}
          </div>
          <div className="ml-4 text-yellow-300">
            const [activeTab, setActiveTab] = useState(&quot;support&quot;);
          </div>
          <div className="mt-2 ml-4 text-gray-300">return (</div>
          <div className="ml-8 text-gray-300">
            &lt;div className=&quot;flex h-[600px] border rounded-lg&quot;&gt;
          </div>

          {/* Ghost text (autocomplete suggestion) */}
          <div className="ml-12 flex items-center gap-3">
            <span className="text-gray-500/40">
              &lt;Navigation activeTab={"{activeTab}"} /&gt;
            </span>
            <span className="animate-pulse-soft rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              Tab ↵
            </span>
          </div>

          <div className="ml-8 text-gray-300">&lt;/div&gt;</div>
          <div className="ml-4 text-gray-300">);</div>
          <div className="text-blue-400">{"}"}</div>
        </div>
      </div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        viewport={{ once: true }}
        className="max-w-sm lg:pl-4"
      >
        <div className="mb-4 inline-flex rounded-xl bg-amber-50 p-3">
          <Sparkles size={20} className="text-amber-600" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-gray-900">
          Magically accurate autocomplete
        </h3>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          Our specialized Tab model predicts your next action with striking
          speed and precision. Works across all languages and frameworks.
        </p>
        <p className="mt-6 inline-flex items-center gap-1.5 font-medium text-blue-600 transition-all duration-200 hover:gap-3">
          Learn about Tab <span>&rarr;</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="product" className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-600"
          >
            Features
          </motion.span>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            The new way to build software.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-500">
            Teskel combines the power of AI with a world-class editor to help
            you ship faster than ever before.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>

        {/* Autocomplete demo */}
        <AutocompleteDemo />

        {/* Agent demo */}
        <AgentDemo />

        {/* More features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="mt-28 text-center"
        >
          <span className="mb-4 inline-block rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-600">
            And more
          </span>
          <h3 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Everything you need, built in.
          </h3>
        </motion.div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {moreFeatures.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
