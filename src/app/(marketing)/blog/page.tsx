"use client";

import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight } from "lucide-react";

const posts = [
  {
    title: "Introducing Teskel Agent 2.0",
    excerpt:
      "Our most powerful AI agent yet — now with multi-file editing, automatic testing, and natural language planning.",
    date: "May 28, 2026",
    readTime: "5 min read",
    category: "Product",
    featured: true,
  },
  {
    title: "How Teskel Tab predicts your next edit",
    excerpt:
      "A deep dive into the technology behind our context-aware autocomplete that understands your entire codebase.",
    date: "May 22, 2026",
    readTime: "8 min read",
    category: "Engineering",
    featured: false,
  },
  {
    title: "SOC 2 Type II: What it means for you",
    excerpt:
      "We've achieved SOC 2 Type II certification. Here's what that means for enterprise security and your data.",
    date: "May 15, 2026",
    readTime: "4 min read",
    category: "Security",
    featured: false,
  },
  {
    title: "Building a startup with Teskel",
    excerpt:
      "How a team of 3 engineers shipped their MVP in 2 weeks using Teskel as their AI pair programmer.",
    date: "May 10, 2026",
    readTime: "6 min read",
    category: "Case Study",
    featured: false,
  },
  {
    title: "The future of coding agents",
    excerpt:
      "Our vision for AI-powered software development and what comes after autocomplete.",
    date: "May 5, 2026",
    readTime: "10 min read",
    category: "Vision",
    featured: false,
  },
  {
    title: "Teskel vs GitHub Copilot: An honest comparison",
    excerpt:
      "We compare features, speed, accuracy, and developer experience between Teskel and Copilot.",
    date: "Apr 28, 2026",
    readTime: "7 min read",
    category: "Comparison",
    featured: false,
  },
];

const categoryColors: Record<string, string> = {
  Product: "bg-blue-100 text-blue-700",
  Engineering: "bg-purple-100 text-purple-700",
  Security: "bg-green-100 text-green-700",
  "Case Study": "bg-amber-100 text-amber-700",
  Vision: "bg-rose-100 text-rose-700",
  Comparison: "bg-cyan-100 text-cyan-700",
};

export default function BlogPage() {
  const featured = posts.find((p) => p.featured);
  const rest = posts.filter((p) => !p.featured);

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Blog
          </h1>
          <p className="mt-4 text-base text-gray-600">
            Product updates, engineering insights, and company news.
          </p>
        </motion.div>

        {/* Featured post */}
        {featured && (
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="group mb-12 cursor-pointer rounded-2xl border border-gray-200 bg-white p-8 transition-all hover:border-rose-200 hover:shadow-lg"
          >
            <span className="mb-4 inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
              Featured
            </span>
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 group-hover:text-rose-600 md:text-3xl">
              {featured.title}
            </h2>
            <p className="mb-4 max-w-2xl text-base text-gray-600">
              {featured.excerpt}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {featured.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {featured.readTime}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[featured.category]}`}
              >
                {featured.category}
              </span>
            </div>
          </motion.article>
        )}

        {/* Post grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-rose-200 hover:shadow-md"
            >
              <span
                className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[post.category]}`}
              >
                {post.category}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-rose-600">
                {post.title}
              </h3>
              <p className="mb-4 text-sm text-gray-600">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {post.readTime}
                  </span>
                </div>
                <ArrowRight
                  size={14}
                  className="text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}
