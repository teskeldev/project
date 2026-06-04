import { Sparkles } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-white">
      <div className="text-center">
        <div className="mb-4 inline-flex animate-pulse items-center justify-center rounded-2xl bg-blue-50 p-3">
          <Sparkles size={24} className="text-blue-600" />
        </div>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
