import Link from "next/link";
import { Button } from "@/components/ui";

export default function CTA() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1100px] text-center">
        <h2 className="text-[2.25rem] font-medium tracking-tight text-foreground md:text-[3rem]">
          Try Teskel now.
        </h2>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-full px-7 py-3.5 text-[15px]">
            <Link href="/download" className="inline-flex items-center gap-2">
              Download for free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-80">
                <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-7 py-3.5 text-[15px]">
            <Link href="/enterprise" className="inline-flex items-center gap-2">
              Contact Sales
              <span className="text-text-muted">&rarr;</span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
