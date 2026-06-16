import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
