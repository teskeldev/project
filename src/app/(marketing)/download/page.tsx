import type { Metadata } from "next";
import DownloadPage from "./download-client";

export const metadata: Metadata = {
  title: "Download",
  description:
    "Download Teskel for Windows, macOS, and Linux. Also available via npm, Homebrew, and curl.",
  openGraph: {
    title: "Download Teskel",
    description:
      "Download Teskel for Windows, macOS, and Linux. Also available via npm, Homebrew, and curl.",
    url: "/download",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Download Teskel",
    description:
      "Download Teskel for Windows, macOS, and Linux. Also available via npm, Homebrew, and curl.",
  },
};

export default function Page() {
  return <DownloadPage />;
}
