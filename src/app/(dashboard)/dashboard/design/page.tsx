"use client";

import { useState } from "react";
import {
  Send,
  Smartphone,
  Tablet,
  Monitor,
  Code,
  Eye,
  RotateCcw,
  Download,
  Copy,
  History,
  Sparkles,
  Palette,
  Layout,
  Type,
  Image,
  Square,
  ChevronRight,
} from "lucide-react";

type ViewMode = "preview" | "code" | "split";
type DeviceSize = "mobile" | "tablet" | "desktop";

interface DesignVersion {
  id: number;
  label: string;
  time: string;
  active: boolean;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  hasDesign?: boolean;
}

const templates = [
  { id: "landing", label: "Landing Page", icon: Layout },
  { id: "card", label: "Card Component", icon: Square },
  { id: "form", label: "Form UI", icon: Type },
  { id: "dashboard", label: "Dashboard", icon: Monitor },
  { id: "gallery", label: "Image Gallery", icon: Image },
  { id: "pricing", label: "Pricing Table", icon: Palette },
];

const versions: DesignVersion[] = [
  { id: 1, label: "Initial design", time: "3m ago", active: false },
  { id: 2, label: "Added gradient header", time: "2m ago", active: false },
  { id: 3, label: "Current version", time: "Now", active: true },
];

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "user",
    content: "Create a modern pricing card with 3 tiers: Free, Pro, and Enterprise. Use a clean design with a highlighted Pro tier.",
  },
  {
    id: 2,
    role: "assistant",
    content: "I've created a modern pricing card component with 3 tiers. The Pro tier is highlighted with a blue accent and \"Popular\" badge. Each tier includes features, pricing, and a CTA button.",
    hasDesign: true,
  },
  {
    id: 3,
    role: "user",
    content: "Make the Pro card slightly elevated with a shadow, and add a gradient background to the header section.",
  },
  {
    id: 4,
    role: "assistant",
    content: "Updated! The Pro card now has elevation with a larger shadow, and I've added a subtle gradient (blue to indigo) to the header area. The design feels more premium now.",
    hasDesign: true,
  },
];

const generatedCode = `export default function PricingCards() {
  return (
    <div className="flex gap-6 p-8">
      {/* Free Tier */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Free</h3>
        <p className="mt-1 text-sm text-gray-500">For individuals</p>
        <p className="mt-4 text-3xl font-bold">$0<span className="text-sm font-normal text-gray-400">/mo</span></p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600">
          <li>✓ 5 projects</li>
          <li>✓ Basic analytics</li>
          <li>✓ Community support</li>
        </ul>
        <button className="mt-6 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium">
          Get Started
        </button>
      </div>

      {/* Pro Tier - Highlighted */}
      <div className="flex-1 rounded-xl border-2 border-blue-500 bg-white p-6 shadow-xl shadow-blue-100">
        <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-4 -mx-2 -mt-2 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Pro</h3>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">Popular</span>
          </div>
          <p className="mt-1 text-sm text-blue-100">For growing teams</p>
        </div>
        <p className="text-3xl font-bold">$29<span className="text-sm font-normal text-gray-400">/mo</span></p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600">
          <li>✓ Unlimited projects</li>
          <li>✓ Advanced analytics</li>
          <li>✓ Priority support</li>
          <li>✓ Custom domains</li>
        </ul>
        <button className="mt-6 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Upgrade to Pro
        </button>
      </div>

      {/* Enterprise Tier */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
        <p className="mt-1 text-sm text-gray-500">For large organizations</p>
        <p className="mt-4 text-3xl font-bold">Custom</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600">
          <li>✓ Everything in Pro</li>
          <li>✓ SSO & SAML</li>
          <li>✓ Dedicated support</li>
          <li>✓ SLA guarantee</li>
          <li>✓ Custom integrations</li>
        </ul>
        <button className="mt-6 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium">
          Contact Sales
        </button>
      </div>
    </div>
  );
}`;

export default function DesignPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now(), role: "user", content: input }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "I've updated the design based on your feedback. The changes are now reflected in the preview.",
          hasDesign: true,
        },
      ]);
    }, 1000);
  };

  const deviceWidth = device === "mobile" ? "w-[375px]" : device === "tablet" ? "w-[768px]" : "w-full";

  return (
    <div className="flex h-full">
      {/* Left panel - Chat */}
      <div className="flex w-[380px] flex-col border-r border-gray-100">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            <h2 className="text-[14px] font-semibold text-gray-900">Teskel Design</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Templates"
            >
              <Layout size={14} />
            </button>
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Version history"
            >
              <History size={14} />
            </button>
          </div>
        </div>

        {/* Templates panel */}
        {showTemplates && (
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-gray-500">Quick Start Templates</p>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 text-center transition-all hover:border-blue-200 hover:shadow-sm"
                  onClick={() => {
                    setInput(`Create a ${t.label.toLowerCase()} component`);
                    setShowTemplates(false);
                  }}
                >
                  <t.icon size={16} className="text-gray-500" />
                  <span className="text-[10px] text-gray-600">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Version history panel */}
        {showVersions && (
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-gray-500">Version History</p>
            <div className="space-y-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                    v.active ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${v.active ? "bg-blue-500" : "bg-gray-300"}`} />
                    <span className="text-[12px] text-gray-700">{v.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{v.time}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-gray-900 text-[13px] text-white"
                    : "border border-gray-100 bg-white text-[13px] text-gray-700"
                }`}
              >
                <p className="leading-relaxed">{msg.content}</p>
                {msg.hasDesign && msg.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1">
                    <Eye size={12} className="text-blue-600" />
                    <span className="text-[11px] font-medium text-blue-700">Design updated</span>
                    <ChevronRight size={12} className="ml-auto text-blue-400" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Describe your design..."
              className="flex-1 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              className="rounded-md bg-gray-900 p-1.5 text-white transition-colors hover:bg-gray-800"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-gray-400">
            Tip: Be specific about colors, layout, and interactions
          </p>
        </div>
      </div>

      {/* Right panel - Preview */}
      <div className="flex flex-1 flex-col">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <div className="flex items-center gap-1">
            {/* View mode */}
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "preview" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Eye size={13} />
              Preview
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "code" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Code size={13} />
              Code
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "split" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Layout size={13} />
              Split
            </button>
          </div>

          {/* Device size */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setDevice("mobile")}
              className={`rounded-md p-1.5 transition-colors ${device === "mobile" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Mobile (375px)"
            >
              <Smartphone size={14} />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={`rounded-md p-1.5 transition-colors ${device === "tablet" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Tablet (768px)"
            >
              <Tablet size={14} />
            </button>
            <button
              onClick={() => setDevice("desktop")}
              className={`rounded-md p-1.5 transition-colors ${device === "desktop" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Desktop (full)"
            >
              <Monitor size={14} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Reset">
              <RotateCcw size={14} />
            </button>
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Copy code">
              <Copy size={14} />
            </button>
            <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Download">
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className={`flex flex-1 items-start justify-center overflow-auto bg-[#F7F7F5] p-6 ${viewMode === "split" ? "border-r border-gray-100" : ""}`}>
              <div className={`${deviceWidth} mx-auto overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-300`}>
                {/* Rendered design preview */}
                <div className="p-6">
                  <div className={`flex ${device === "mobile" ? "flex-col" : ""} gap-4`}>
                    {/* Free tier */}
                    <div className="flex-1 rounded-xl border border-gray-200 p-5">
                      <h3 className="text-[16px] font-semibold text-gray-900">Free</h3>
                      <p className="mt-0.5 text-[12px] text-gray-500">For individuals</p>
                      <p className="mt-3 text-[24px] font-bold text-gray-900">
                        $0<span className="text-[12px] font-normal text-gray-400">/mo</span>
                      </p>
                      <ul className="mt-4 space-y-2 text-[12px] text-gray-600">
                        <li>✓ 5 projects</li>
                        <li>✓ Basic analytics</li>
                        <li>✓ Community support</li>
                      </ul>
                      <button className="mt-5 w-full rounded-lg border border-gray-200 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50">
                        Get Started
                      </button>
                    </div>

                    {/* Pro tier - highlighted */}
                    <div className="flex-1 rounded-xl border-2 border-blue-500 p-5 shadow-lg shadow-blue-100">
                      <div className="-mx-2 -mt-2 mb-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[16px] font-semibold text-white">Pro</h3>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                            Popular
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-blue-100">For growing teams</p>
                      </div>
                      <p className="text-[24px] font-bold text-gray-900">
                        $29<span className="text-[12px] font-normal text-gray-400">/mo</span>
                      </p>
                      <ul className="mt-4 space-y-2 text-[12px] text-gray-600">
                        <li>✓ Unlimited projects</li>
                        <li>✓ Advanced analytics</li>
                        <li>✓ Priority support</li>
                        <li>✓ Custom domains</li>
                      </ul>
                      <button className="mt-5 w-full rounded-lg bg-blue-600 py-2 text-[12px] font-medium text-white hover:bg-blue-700">
                        Upgrade to Pro
                      </button>
                    </div>

                    {/* Enterprise tier */}
                    <div className="flex-1 rounded-xl border border-gray-200 p-5">
                      <h3 className="text-[16px] font-semibold text-gray-900">Enterprise</h3>
                      <p className="mt-0.5 text-[12px] text-gray-500">For large organizations</p>
                      <p className="mt-3 text-[24px] font-bold text-gray-900">Custom</p>
                      <ul className="mt-4 space-y-2 text-[12px] text-gray-600">
                        <li>✓ Everything in Pro</li>
                        <li>✓ SSO & SAML</li>
                        <li>✓ Dedicated support</li>
                        <li>✓ SLA guarantee</li>
                        <li>✓ Custom integrations</li>
                      </ul>
                      <button className="mt-5 w-full rounded-lg border border-gray-200 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50">
                        Contact Sales
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Code view */}
          {(viewMode === "code" || viewMode === "split") && (
            <div className="flex-1 overflow-auto bg-[#0B0F19]">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                <span className="text-[11px] text-gray-400">PricingCards.tsx</span>
                <button className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300">
                  <Copy size={12} />
                </button>
              </div>
              <pre className="overflow-auto p-4 font-mono text-[11px] leading-5 text-gray-300">
                {generatedCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
