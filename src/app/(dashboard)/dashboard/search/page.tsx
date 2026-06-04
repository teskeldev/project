"use client";

import { useState } from "react";
import { Search, FileCode, FolderOpen, Hash, ArrowRight } from "lucide-react";

interface SearchResult {
  id: number;
  file: string;
  line: number;
  content: string;
  match: string;
  type: "code" | "symbol" | "file";
}

const mockResults: SearchResult[] = [
  { id: 1, file: "src/components/Hero.tsx", line: 10, content: "Built to make you extraordinarily productive", match: "productive", type: "code" },
  { id: 2, file: "src/app/(dashboard)/dashboard/chat/page.tsx", line: 45, content: "export default function ChatPage() {", match: "ChatPage", type: "symbol" },
  { id: 3, file: "src/components/Features.tsx", line: 22, content: "Choose between every cutting-edge model", match: "model", type: "code" },
  { id: 4, file: "src/app/(dashboard)/layout.tsx", line: 1, content: "import Sidebar from \"@/components/dashboard/Sidebar\"", match: "Sidebar", type: "symbol" },
  { id: 5, file: "src/components/Navbar.tsx", line: 8, content: "{ label: \"Product\", href: \"/#product\" }", match: "Product", type: "code" },
  { id: 6, file: "package.json", line: 12, content: "\"framer-motion\": \"^12.15.0\"", match: "framer-motion", type: "file" },
  { id: 7, file: "src/app/globals.css", line: 3, content: "@import \"tailwindcss\";", match: "tailwindcss", type: "file" },
  { id: 8, file: "src/components/dashboard/Sidebar.tsx", line: 50, content: "const [collapsed, setCollapsed] = useState(false)", match: "collapsed", type: "symbol" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "code" | "symbol" | "file">("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    const filtered = searchType === "all"
      ? mockResults.filter((r) => r.content.toLowerCase().includes(query.toLowerCase()) || r.file.toLowerCase().includes(query.toLowerCase()))
      : mockResults.filter((r) => r.type === searchType && (r.content.toLowerCase().includes(query.toLowerCase()) || r.file.toLowerCase().includes(query.toLowerCase())));
    setResults(filtered.length > 0 ? filtered : mockResults.slice(0, 5));
    setSearched(true);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-semibold text-gray-900">Semantic Search</h1>
          <p className="mt-1 text-[14px] text-gray-500">Search across your entire codebase with natural language</p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search code, symbols, files... (try &quot;authentication&quot; or &quot;useState&quot;)"
              className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-[14px] text-gray-900 shadow-sm placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
            />
            <button
              onClick={handleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-gray-900 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800"
            >
              Search
            </button>
          </div>

          {/* Type tabs */}
          <div className="mt-3 flex gap-2">
            {(["all", "code", "symbol", "file"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSearchType(type)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                  searchType === type ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "code" && <FileCode size={12} />}
                {type === "symbol" && <Hash size={12} />}
                {type === "file" && <FolderOpen size={12} />}
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div>
            <p className="mb-4 text-[13px] text-gray-500">{results.length} results found</p>
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        result.type === "code" ? "bg-blue-50 text-blue-600" :
                        result.type === "symbol" ? "bg-purple-50 text-purple-600" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {result.type}
                      </span>
                      <span className="text-[13px] font-medium text-gray-900">{result.file}</span>
                      <span className="text-[11px] text-gray-400">:{result.line}</span>
                    </div>
                    <ArrowRight size={14} className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-2 overflow-hidden rounded bg-gray-50 px-3 py-2">
                    <code className="text-[12px] text-gray-700">{result.content}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!searched && (
          <div className="mt-20 text-center">
            <Search size={40} className="mx-auto text-gray-200" />
            <p className="mt-4 text-[14px] text-gray-400">Enter a query to search across your codebase</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Where is auth handled?", "useState hooks", "API routes", "database schema"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleSearch(); }}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-[12px] text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
