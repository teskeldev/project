import { Tag, Loader2 } from "lucide-react";

export default function AliasesLoading() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="mb-4 inline-flex animate-pulse items-center justify-center rounded-2xl bg-violet-500/10 p-4">
          <Tag className="h-6 w-6 text-violet-400" />
        </div>
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-zinc-600" />
        <p className="text-sm font-medium text-zinc-400">Loading Model Aliases</p>
        <p className="mt-1 text-xs text-zinc-600">First load compiles the page bundle</p>
      </div>
    </div>
  );
}
