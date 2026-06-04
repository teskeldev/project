"use client";

import { useState } from "react";
import { Search, Check, ExternalLink, Plus } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  icon: string;
}

const integrations: Integration[] = [
  { id: "github", name: "GitHub", description: "Connect repositories, create PRs, manage issues", category: "Version Control", installed: true, icon: "GH" },
  { id: "gitlab", name: "GitLab", description: "CI/CD pipelines, merge requests, repositories", category: "Version Control", installed: false, icon: "GL" },
  { id: "linear", name: "Linear", description: "Issue tracking, project management, sprints", category: "Project Management", installed: true, icon: "LN" },
  { id: "jira", name: "Jira", description: "Agile boards, epics, sprints, backlog management", category: "Project Management", installed: false, icon: "JR" },
  { id: "slack", name: "Slack", description: "Send messages, receive notifications, search channels", category: "Communication", installed: true, icon: "SL" },
  { id: "discord", name: "Discord", description: "Bot integration, channel management, webhooks", category: "Communication", installed: false, icon: "DC" },
  { id: "vercel", name: "Vercel", description: "Deploy previews, production deployments, analytics", category: "Deployment", installed: true, icon: "VC" },
  { id: "aws", name: "AWS", description: "S3, Lambda, EC2, CloudFormation, IAM management", category: "Cloud", installed: false, icon: "AW" },
  { id: "postgres", name: "PostgreSQL", description: "Query database, manage schemas, run migrations", category: "Database", installed: true, icon: "PG" },
  { id: "redis", name: "Redis", description: "Cache management, pub/sub, data structures", category: "Database", installed: false, icon: "RD" },
  { id: "stripe", name: "Stripe", description: "Payment processing, subscriptions, invoices", category: "Payments", installed: true, icon: "ST" },
  { id: "sentry", name: "Sentry", description: "Error tracking, performance monitoring, alerts", category: "Monitoring", installed: false, icon: "SN" },
  { id: "figma", name: "Figma", description: "Read designs, extract tokens, generate components", category: "Design", installed: false, icon: "FG" },
  { id: "notion", name: "Notion", description: "Read docs, create pages, sync knowledge base", category: "Documentation", installed: true, icon: "NT" },
];

const categories = [...new Set(integrations.map((i) => i.category))];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = integrations.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || i.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-semibold text-gray-900">MCP Integrations</h1>
          <p className="mt-1 text-[14px] text-gray-500">Connect tools and services to extend Teskel&apos;s capabilities</p>
        </div>

        {/* Search & filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              !activeCategory ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({integrations.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeCategory === cat ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((integration) => (
            <div
              key={integration.id}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-gray-600">
                    {integration.icon}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900">{integration.name}</h3>
                    <p className="text-[11px] text-gray-400">{integration.category}</p>
                  </div>
                </div>
                {integration.installed ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                    <Check size={12} />
                    Connected
                  </span>
                ) : (
                  <button className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                    <Plus size={12} />
                    Connect
                  </button>
                )}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-gray-500">{integration.description}</p>
              {integration.installed && (
                <button className="mt-3 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                  Configure <ExternalLink size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
