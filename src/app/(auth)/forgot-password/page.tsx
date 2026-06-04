"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <Mail className="text-blue-600" size={24} />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            We sent a password reset link to{" "}
            <span className="font-medium text-gray-700">{email}</span>
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

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Reset your password
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter the email associated with your account and we&apos;ll send you a
          reset link.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="flex flex-col gap-4"
        >
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
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Send reset link
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
