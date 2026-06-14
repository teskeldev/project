"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/composer");
  }, [router]);
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-gray-500">Redirecting to Code Review...</p>
    </div>
  );
}
