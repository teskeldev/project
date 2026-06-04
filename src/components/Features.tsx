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
  },
  {
    icon: Zap,
    title: "Lightning-fast Agent",
    description:
      "Teskel Agent can plan, search, and build entire features across your codebase. Give it a task and watch it work.",
    link: "Learn about Agent",
  },
  {
    icon: Terminal,
    title: "Inline terminal commands",
    description:
      "Run shell commands, install packages, and manage your dev environment without leaving the editor.",
    link: "Learn about Terminal",
  },
  {
    icon: GitBranch,
    title: "Git-native workflow",
    description:
      "Commit, push, branch, and resolve merge conflicts — all integrated directly into your editing experience.",
    link: "Learn about Git",
  },
];

const moreFeatures = [
  {
    icon: Code2,
    title: "Multi-file editing",
    description:
      "Edit across multiple files simultaneously with context-aware suggestions that understand your entire project.",
  },
  {
    icon: MessageSquare,
    title: "Chat with your codebase",
    description:
      "Ask questions, get explanations, and generate code in a conversational chat that knows your repo.",
  },
  {
    icon: Layers,
    title: "Plan Mission Control",
    description:
      "Break complex tasks into steps. Teskel tracks progress, shows diffs, and manages multiple workstreams.",
  },
  {
    icon: Shield,
    title: "Privacy & security first",
    description:
      "SOC 2 certified. Your code stays yours — with options for local-only mode and zero data retention.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
  link,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  link?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="group rounded-2xl border border-[#E5E7EB] bg-white/70 p-8 backdrop-blur-sm transition-all hover:border-blue-200 hover:shadow-lg"
    >
      <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-3">
        <Icon size={24} className="text-blue-600" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
      {link && (
        <p className="mt-4 text-sm font-medium text-blue-600 transition-colors group-hover:text-blue-700">
          {link} &rarr;
        </p>
      )}
    </motion.div>
  );
}

function AgentDemo() {
  const tasks = [
    { label: "Build Landing Page", status: "Reading docs", progress: true },
    {
      label: "Analyze Tab vs Agent Usage P...",
      status: "Fetching data",
      progress: true,
    },
    {
      label: "Plan Mission Control",
      status: "Generating plan",
      progress: true,
    },
  ];

  const readyTasks = [
    { label: "PyTorch MNIST Experim...", time: "10m" },
    { label: "Set up Teskel Rules for ...", time: "30m" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <span className="text-sm font-medium text-gray-400">
          Teskel Desktop
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Get Teskel</span>
          <span className="text-gray-600">&#8943;</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-72 border-r border-gray-700 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            In Progress 3
          </p>
          {tasks.map((task, i) => (
            <div
              key={i}
              className="mb-3 flex items-start gap-3 rounded-lg p-2 hover:bg-gray-800"
            >
              <div className="mt-1 h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {task.label}
                </p>
                <p className="text-xs text-gray-500">{task.status}</p>
              </div>
            </div>
          ))}

          <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ready for Review 3
          </p>
          {readyTasks.map((task, i) => (
            <div
              key={i}
              className="mb-3 flex items-start gap-3 rounded-lg p-2 hover:bg-gray-800"
            >
              <div className="mt-1 h-4 w-4 rounded-full border-2 border-green-400" />
              <div className="flex flex-1 items-center justify-between">
                <p className="text-sm font-medium text-gray-200">
                  {task.label}
                </p>
                <span className="text-xs text-gray-500">{task.time}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              Build Landing Page
            </h3>
            <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-sm text-gray-300">
                make a landing page based on attached docs explaining what we do
              </p>
            </div>
          </div>

          {/* Browser preview */}
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <div className="h-2 w-2 rounded-full bg-gray-600" />
              </div>
              <div className="flex-1 rounded-md bg-gray-700 px-3 py-1 text-center text-xs text-gray-400">
                http://localhost:3000
              </div>
            </div>
            <div className="bg-white p-6">
              <p className="font-serif text-lg italic text-gray-800">
                Acme Labs
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Software creation is changing. We are a group of researchers,
                engineers, and technologists inventing at the edge of
                what&apos;s useful and possible.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                We have much to learn, try, and build.
              </p>
              <button className="mt-4 text-sm font-medium text-gray-800 underline">
                See projects
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
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="mx-auto mt-16 flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-center"
    >
      {/* Editor */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-gray-400">Teskel</span>
          <span className="text-xs text-gray-500">Get Teskel</span>
        </div>

        <div className="flex border-b border-gray-700">
          <div className="border-r border-gray-700 bg-gray-800 px-4 py-2 text-xs text-white">
            Dashboard.tsx <span className="text-gray-500">&times;</span>
          </div>
          <div className="px-4 py-2 text-xs text-gray-400">
            SupportChat.tsx
          </div>
        </div>

        <div className="p-6 font-mono text-sm leading-relaxed">
          <div className="text-green-400">&quot;use client&quot;;</div>
          <div className="mt-2 text-purple-400">
            import React, {"{ useState }"} from &quot;react&quot;;
          </div>
          <div className="text-purple-400">
            import Navigation from &quot;./Navigation&quot;;
          </div>
          <div className="text-purple-400">
            import SupportChat from &quot;./SupportChat&quot;;
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
          <div className="ml-12 text-gray-300">
            &lt;div className=&quot;w-64 border-r&quot;&gt;
          </div>

          {/* Ghost text (autocomplete suggestion) */}
          <div className="ml-16 flex items-center gap-2">
            <span className="text-gray-500/50">
              &lt;Navigation activeTab={"{activeTab}"} /&gt;
            </span>
            <span className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 text-xs text-blue-400">
              Tab to accept
            </span>
          </div>

          <div className="ml-12 text-gray-300">&lt;/div&gt;</div>
          <div className="ml-8 text-gray-300">&lt;/div&gt;</div>
          <div className="ml-4 text-gray-300">);</div>
          <div className="text-blue-400">{"}"}</div>
        </div>
      </div>

      {/* Description */}
      <div className="max-w-sm lg:pl-8">
        <h3 className="text-2xl font-semibold text-gray-900">
          Magically accurate autocomplete
        </h3>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Our specialized Tab model predicts your next action with striking
          speed and precision.
        </p>
        <p className="mt-6 font-medium text-blue-600">Learn about Tab &rarr;</p>
      </div>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="product" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        {/* Main features */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            The new way to build software.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
            Teskel combines the power of AI with a world-class editor to help
            you ship faster than ever before.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>

        {/* Autocomplete demo */}
        <AutocompleteDemo />

        {/* Agent demo */}
        <AgentDemo />

        {/* More features grid */}
        <motion.h3
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mt-24 text-center text-2xl font-semibold text-gray-900 md:text-3xl"
        >
          Everything you need, built in.
        </motion.h3>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {moreFeatures.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
