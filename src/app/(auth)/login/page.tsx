"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

function sanitizeCallbackUrl(url: string | null): string {
  const defaultUrl = "/dashboard";
  if (!url) return defaultUrl;
  if (!url.startsWith("/") || url.includes("//") || url.includes("\\")) {
    return defaultUrl;
  }
  return url;
}

function OAuthButtons() {
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(null);

  useEffect(() => {
    getProviders().then((p) => setProviders(p ?? {}));
  }, []);

  const googleConfigured = providers ? "google" in providers : null;
  const githubConfigured = providers ? "github" in providers : null;

  return (
    <div className="flex flex-col gap-3">
      {githubConfigured === false ? (
        <button type="button" disabled className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-medium text-slate-400 cursor-not-allowed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
          GitHub <span className="text-xs text-slate-300">(Not configured)</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={githubConfigured === null}
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-medium text-white transition-all hover:bg-black hover:shadow-[0_8px_20px_rgba(17,24,39,0.15)] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
          Continue with GitHub
        </button>
      )}

      {googleConfigured === false ? (
        <button type="button" disabled className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-medium text-slate-400 cursor-not-allowed">
           <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" fillOpacity="0.4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" fillOpacity="0.4" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" fillOpacity="0.4" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" fillOpacity="0.4" /></svg>
          Google <span className="text-xs text-slate-300">(Not configured)</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={googleConfigured === null}
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[14px] font-medium text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
          Continue with Google
        </button>
      )}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      {/* Premium Branding */}
      <div className="mb-10 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 shadow-[0_4px_14px_rgba(28,25,23,0.4)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M4 4h16v16H4V4zm8 0h4v16h-4V4z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[22px] font-bold tracking-tight text-slate-900">
            Teskel
          </span>
        </Link>
      </div>

      {/* Floating Glassmorphism Card */}
      <div className="rounded-[24px] border border-white/60 bg-white/70 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(0,0,0,0.01),0_8px_32px_rgba(17,24,39,0.04)] backdrop-blur-2xl">
        <h1 className="mb-2 text-[24px] font-semibold tracking-tight text-slate-900 text-center">
          Log in to your workspace
        </h1>
        <p className="mb-8 text-sm text-slate-500 text-center">
          Enter your details below to continue.
        </p>

        {/* Social login */}
        <OAuthButtons />

        <div className="my-8 flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-slate-200/60" />
          <span className="text-[11px] font-medium tracking-widest text-slate-400 uppercase">OR</span>
          <div className="h-[1px] flex-1 bg-slate-200/60" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-xl border border-red-200/50 bg-red-50/50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </motion.div>
          )}
          <div>
            <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-slate-700">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-stone-500 focus:ring-4 focus:ring-stone-500/10 disabled:opacity-60 shadow-sm"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-[12px] font-medium text-stone-600 transition-colors hover:text-stone-900">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-stone-500 focus:ring-4 focus:ring-stone-500/10 disabled:opacity-60 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-[14px] font-medium text-white shadow-[0_4px_14px_rgba(28,25,23,0.3)] transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Log in to workspace"}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setEmail("demo@teskel.dev");
              setPassword("password");
            }}
            disabled={loading}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use Demo Account
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-[13px] text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-slate-900 transition-colors hover:text-stone-600">
          Sign up for free
        </Link>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
