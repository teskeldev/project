"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "Something went wrong. Please try again.");
        setLoading(false);
        startCooldown();
        return;
      }

      setSubmitted(true);
      startCooldown();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      startCooldown();
    }
  };

  if (submitted) {
    return (
      <div className="animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 28 28"
              fill="none"
              className="text-gray-900"
            >
              <rect width="28" height="28" rx="6" fill="currentColor" />
              <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
            </svg>
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              TESKEL
            </span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            If an account with <strong>{email}</strong> exists, we&apos;ve sent a
            password reset link. Please check your inbox and spam folder.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 28 28"
            fill="none"
            className="text-gray-900"
          >
            <rect width="28" height="28" rx="6" fill="currentColor" />
            <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
          </svg>
          <span className="text-2xl font-bold tracking-tight text-gray-900">
            TESKEL
          </span>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-8 shadow-lg shadow-gray-200/50 backdrop-blur-sm transition-all duration-500">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Reset your password
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading || cooldown > 0}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Sending..."
              : cooldown > 0
                ? `Try again in ${cooldown}s`
                : "Send reset link"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
