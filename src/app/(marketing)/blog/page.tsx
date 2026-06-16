import type { Metadata } from "next";
import BlogPage from "./blog-client";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Product updates, engineering insights, and company news from the Teskel team.",
  openGraph: {
    title: "Blog · Teskel",
    description:
      "Product updates, engineering insights, and company news from the Teskel team.",
    url: "/blog",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Blog · Teskel",
    description:
      "Product updates, engineering insights, and company news from the Teskel team.",
  },
};

export default function Page() {
  return <BlogPage />;
}
