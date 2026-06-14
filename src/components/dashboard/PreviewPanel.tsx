"use client";

import { useState, useRef, useCallback } from "react";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";

type DeviceSize = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceSize, string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

export default function PreviewPanel({
  defaultUrl,
  onClose,
}: {
  defaultUrl?: string;
  onClose?: () => void;
}) {
  const [url, setUrl] = useState(defaultUrl || "http://localhost:3000");
  const [inputUrl, setInputUrl] = useState(url);
  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigate = useCallback((newUrl: string) => {
    try {
      // Validate URL
      new URL(newUrl);
      setUrl(newUrl);
      setInputUrl(newUrl);
      setError(false);
      setLoading(true);
    } catch {
      setError(true);
    }
  }, []);

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = url;
    }
  }, [url]);

  const handleBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // Cross-origin access may be blocked; silently ignore
    }
  }, []);

  const handleForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // Cross-origin access may be blocked; silently ignore
    }
  }, []);

  const handleIframeError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  return (
    <div className="flex h-full flex-col border-l border-border">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-background px-2">
        <button onClick={handleBack} className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Back">
          <ChevronLeft size={14} />
        </button>
        <button onClick={handleForward} className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Forward">
          <ChevronRight size={14} />
        </button>
        <button onClick={refresh} className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Refresh">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1">
            <Globe size={12} className="shrink-0 text-text-muted" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 bg-transparent text-xs text-text-secondary focus:outline-none"
              placeholder="http://localhost:3000"
            />
          </div>
        </form>

        {/* Device toggles */}
        <div className="flex items-center gap-0.5">
          {([["mobile", Smartphone], ["tablet", Tablet], ["desktop", Monitor]] as const).map(([size, Icon]) => (
            <button
              key={size}
              onClick={() => setDevice(size as DeviceSize)}
              className={`rounded p-1 ${device === size ? "bg-border text-foreground" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title={size}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <button
          onClick={() => window.open(url, "_blank")}
          className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
          title="Open in new tab"
        >
          <ExternalLink size={14} />
        </button>

        {onClose && (
          <button onClick={onClose} className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Close preview">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Preview iframe */}
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-surface-soft">
        {error ? (
          <div className="text-center">
            <Globe size={32} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-secondary">Invalid URL or failed to load</p>
            <p className="mt-1 text-xs text-text-muted">Enter a valid URL to preview</p>
          </div>
        ) : (
          <div className="h-full transition-all duration-300" style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}>
            <iframe
              ref={iframeRef}
              src={url}
              className="h-full w-full border-0 bg-surface"
              sandbox="allow-scripts allow-forms"
              onLoad={() => setLoading(false)}
              onError={handleIframeError}
              title="Live Preview"
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-background px-3">
        <span className="text-[10px] text-text-muted">
          {loading ? "Loading..." : error ? "Error" : "Ready"}
        </span>
        <span className="text-[10px] text-text-muted">{device}</span>
      </div>
    </div>
  );
}
