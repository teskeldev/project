"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, Check, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type StartResult =
  | { type: "redirect"; url: string }
  | {
      type: "device_code";
      sessionKey: string;
      userCode: string;
      verificationUri: string;
      interval: number;
      expiresIn: number;
    };

type Step =
  | "idle"
  | "starting"
  | "waiting_popup"
  | "device_code"
  | "polling"
  | "success"
  | "error";

/* -------------------------------------------------------------------------- */
/* OAuthModal                                                                  */
/* -------------------------------------------------------------------------- */

export function OAuthModal({
  provider,
  workspaceId,
  onClose,
  onConnected,
}: {
  provider: string;
  workspaceId: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const cfg = OAUTH_PROVIDER_CONFIGS[provider];

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{
    userCode: string;
    verificationUri: string;
    sessionKey: string;
    interval: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupCheck = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so schedulePoll can call itself recursively without useCallback dependency issues
  const schedulePollRef = useRef<((key: string, interval: number) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (popupCheck.current) clearInterval(popupCheck.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    pollTimer.current = null;
    popupCheck.current = null;
    popupRef.current = null;
  }, []);

  // Listen for postMessage from the popup's /api/oauth/done page
  useEffect(() => {
    function onMessage(e: MessageEvent<{ type?: string; provider?: string; message?: string }>) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.provider !== provider) return;
      if (e.data?.type === "oauth_success") {
        cleanup();
        setStep("success");
        onConnected();
      } else if (e.data?.type === "oauth_error") {
        cleanup();
        setError(e.data.message ?? "Authorization failed");
        setStep("error");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [provider, cleanup, onConnected]);

  useEffect(() => () => cleanup(), [cleanup]);

  /* Poll for device-code status */
  const schedulePoll = useCallback(
    (sessionKey: string, intervalSec: number) => {
      pollTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/oauth/${provider}/poll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionKey }),
          });
          const json = (await res.json()) as {
            success?: boolean;
            data?: { status: string; message?: string; interval?: number };
            error?: { message?: string };
          };

          if (!res.ok) {
            cleanup();
            setError(json.error?.message ?? "Poll request failed");
            setStep("error");
            return;
          }

          const { status, message, interval: next } = json.data!;
          if (status === "authorized") {
            cleanup();
            setStep("success");
            onConnected();
          } else if (status === "denied" || status === "error") {
            cleanup();
            setError(message ?? "Access denied");
            setStep("error");
          } else {
            // Use ref to call self recursively without circular useCallback dep
            schedulePollRef.current?.(sessionKey, next ?? intervalSec);
          }
        } catch {
          schedulePollRef.current?.(sessionKey, intervalSec);
        }
      }, intervalSec * 1000);
    },
    [provider, cleanup, onConnected]
  );

  // Keep ref in sync with latest schedulePoll (useEffect runs after render)
  useEffect(() => { schedulePollRef.current = schedulePoll; });

  /* Start OAuth flow */
  const start = useCallback(async () => {
    setStep("starting");
    setError(null);

    try {
      const res = await fetch(`/api/oauth/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: StartResult;
        error?: { message?: string };
      };

      if (!res.ok) throw new Error(json.error?.message ?? "Failed to start OAuth flow");
      const data = json.data!;

      if (data.type === "redirect") {
        const popup = window.open(data.url, "oauth_popup", "width=620,height=720,scrollbars=yes,resizable=yes");
        popupRef.current = popup;
        setStep("waiting_popup");

        // Detect popup dismissal (user closed without completing)
        popupCheck.current = setInterval(() => {
          if (popup?.closed) {
            clearInterval(popupCheck.current!);
            popupCheck.current = null;
            // Give the postMessage event 600ms to arrive first
            setTimeout(() => {
              setStep((s) => (s === "waiting_popup" ? "idle" : s));
            }, 600);
          }
        }, 800);
      } else {
        setDeviceInfo({
          userCode: data.userCode,
          verificationUri: data.verificationUri,
          sessionKey: data.sessionKey,
          interval: data.interval,
        });
        setStep("device_code");
        // Start polling after one interval
        schedulePoll(data.sessionKey, data.interval);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("error");
    }
  }, [provider, workspaceId, schedulePoll]);

  const copyCode = useCallback(async () => {
    if (!deviceInfo?.userCode) return;
    try {
      await navigator.clipboard.writeText(deviceInfo.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [deviceInfo]);

  if (!cfg) return null;

  const isPkce = cfg.flowType === "authorization_code_pkce";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-white text-sm"
              style={{ backgroundColor: cfg.color }}
            >
              {cfg.icon}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                Connect {cfg.name}
              </h2>
              <p className="text-[11px] text-text-muted">OAuth Authentication</p>
            </div>
          </div>
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="rounded-md p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="space-y-4 px-5 py-6">
          {step === "idle" && (
            <div className="space-y-3">
              <p className="text-[13px] text-text-secondary leading-relaxed">
                {cfg.description}
              </p>
              <p className="text-[12px] text-text-muted">
                {isPkce
                  ? "A browser popup will open to authenticate with the provider. Your credentials are never shared with Teskel."
                  : "You'll receive a short device code to enter on the provider's website — no redirect required."}
              </p>
            </div>
          )}

          {step === "starting" && (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Starting authorization&hellip;
            </div>
          )}

          {step === "waiting_popup" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] text-text-secondary">
                <Loader2 size={16} className="animate-spin text-accent" />
                Waiting for you to authorize in the popup&hellip;
              </div>
              <p className="text-[12px] text-text-muted">
                Complete the sign-in in the window that opened. If nothing appeared,
                check your browser&apos;s popup blocker settings.
              </p>
            </div>
          )}

          {(step === "device_code" || step === "polling") && deviceInfo && (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-soft p-4 text-center">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Device Code
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground">
                  {deviceInfo.userCode}
                </p>
                <button
                  onClick={copyCode}
                  className="mx-auto mt-2.5 flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied!" : "Copy code"}
                </button>
              </div>

              <ol className="space-y-1.5 text-[12px] text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="mt-px shrink-0 font-semibold text-text-muted">1.</span>
                  <span>
                    Visit{" "}
                    <a
                      href={deviceInfo.verificationUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-accent hover:underline"
                    >
                      {deviceInfo.verificationUri}
                      <ExternalLink size={10} />
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-px shrink-0 font-semibold text-text-muted">2.</span>
                  <span>Enter the code above when prompted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-px shrink-0 font-semibold text-text-muted">3.</span>
                  <span>Click &ldquo;Authorize&rdquo; on the provider&apos;s page</span>
                </li>
              </ol>

              {step === "polling" && (
                <div className="flex items-center gap-2 text-[12px] text-text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Waiting for authorization&hellip;
                </div>
              )}
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check size={24} className="text-green-600" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Connected!</p>
              <p className="text-[12px] text-text-muted">
                {cfg.name} has been successfully connected to your workspace.
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error ?? "Authorization failed. Please try again."}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-soft"
          >
            {step === "success" ? "Close" : "Cancel"}
          </button>

          {(step === "idle" || step === "error") && (
            <button
              onClick={start}
              className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
            >
              {step === "error" ? "Try again" : "Connect via OAuth"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
