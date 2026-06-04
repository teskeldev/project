import { Sparkles } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-white/50">
      <div className="animate-scale-in text-center">
        <div className="mb-4 inline-flex animate-pulse-soft items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-lg shadow-blue-100/30">
          <Sparkles size={24} className="animate-spin-slow text-blue-600" />
        </div>
        <p className="animate-fade-in text-sm font-medium text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
