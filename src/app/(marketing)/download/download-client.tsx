"use client";

import { motion } from "framer-motion";
import { Download, Monitor, Apple, Terminal } from "lucide-react";
import { Button, Card, CardTitle, CardDescription } from "@/components/ui";

const platforms = [
  {
    icon: Monitor,
    name: "Windows",
    description: "Windows 10+ (64-bit)",
    filename: "Teskel-Setup-1.0.0.exe",
    downloadUrl: "https://releases.teskel.dev/Teskel-Setup-1.0.0.exe",
    primary: true,
  },
  {
    icon: Apple,
    name: "macOS",
    description: "macOS 12+ (Apple Silicon & Intel)",
    filename: "Teskel-1.0.0-universal.dmg",
    downloadUrl: "https://releases.teskel.dev/Teskel-1.0.0-universal.dmg",
    primary: false,
  },
  {
    icon: Terminal,
    name: "Linux",
    description: "Ubuntu 20.04+, Fedora 36+, Arch",
    filename: "teskel-1.0.0.AppImage",
    downloadUrl: "https://releases.teskel.dev/teskel-1.0.0.AppImage",
    primary: false,
  },
];

export default function DownloadPage() {
  const handleDownload = (platform: string, filename: string) => {
    console.log(`Downloading ${filename} for ${platform}`);
  };

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Download Teskel
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-text-secondary">
            Available on all major platforms. Free to use, with optional Pro
            upgrade.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="rounded-2xl p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
                  <platform.icon size={32} className="text-accent" />
                </div>
                <CardTitle>{platform.name}</CardTitle>
                <CardDescription className="mt-1">
                  {platform.description}
                </CardDescription>
                <Button
                  variant={platform.primary ? "default" : "outline"}
                  className="mt-6 w-full"
                  onClick={() => handleDownload(platform.name, platform.filename)}
                  asChild
                >
                  <a href={platform.downloadUrl} download>
                    <Download size={16} />
                    Download
                  </a>
                </Button>
                <p className="mt-2 text-xs text-text-muted">
                  {platform.filename}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CLI */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12"
        >
          <Card className="rounded-2xl p-8">
            <CardTitle className="mb-4">Install via CLI</CardTitle>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">
                  npm
                </p>
                <div className="rounded-lg bg-primary px-4 py-3 font-mono text-sm text-background">
                  npm install -g @teskel/cli
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">
                  curl
                </p>
                <div className="rounded-lg bg-primary px-4 py-3 font-mono text-sm text-background">
                  curl -fsSL https://teskel.dev/install.sh | sh
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">
                  Homebrew
                </p>
                <div className="rounded-lg bg-primary px-4 py-3 font-mono text-sm text-background">
                  brew install teskel
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* System requirements */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12"
        >
          <Card className="rounded-2xl p-8">
            <CardTitle className="mb-4">System requirements</CardTitle>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-foreground">Minimum</p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  <li>4 GB RAM</li>
                  <li>2 GB disk space</li>
                  <li>64-bit OS</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Recommended
                </p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  <li>8 GB RAM</li>
                  <li>4 GB disk space</li>
                  <li>SSD storage</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Supported OS
                </p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  <li>Windows 10+</li>
                  <li>macOS 12+</li>
                  <li>Ubuntu 20.04+</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
