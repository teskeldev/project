"use client";

const testimonials = [
  {
    quote: "It was night and day from one batch to another, adoption went from single digits to over 80%. It just spread like wildfire, all the best builders were using Teskel.",
    name: "Diana Hu",
    title: "General Partner, Y Combinator",
    initials: "DH",
  },
  {
    quote: "My favorite enterprise AI service is Teskel. Every one of our engineers are now assisted by AI and our productivity has gone up incredibly.",
    name: "Jensen Huang",
    title: "President & CEO, NVIDIA",
    initials: "JH",
  },
  {
    quote: "The best LLM applications have an autonomy slider: you control how much independence to give the AI. In Teskel, you can do Tab completion, inline edits, or let it rip with the full autonomy agentic version.",
    name: "Andrej Karpathy",
    title: "CEO, Eureka Labs",
    initials: "AK",
  },
  {
    quote: "Teskel quickly grew from hundreds to thousands of extremely enthusiastic employees. There's significant economic outcomes when making the development process more efficient.",
    name: "Patrick Collison",
    title: "Co-Founder & CEO, Stripe",
    initials: "PC",
  },
  {
    quote: "The most useful AI tool that I currently pay for, hands down, is Teskel. It's fast, autocompletes when and where you need it to, handles brackets properly — everything is well put together.",
    name: "shadcn",
    title: "Creator of shadcn/ui",
    initials: "SC",
  },
  {
    quote: "It's definitely becoming more fun to be a programmer. We are at the 1% of what's possible, and it's in interactive experiences like Teskel where AI models shine brightest.",
    name: "Greg Brockman",
    title: "President, OpenAI",
    initials: "GB",
  },
];

export default function Testimonials() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="text-center text-[1.75rem] font-medium tracking-tight text-[#0F172A] md:text-[2.25rem]">
          The new way to build software.
        </h2>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-[#E5E7EB] bg-white p-6 transition-shadow hover:shadow-md"
            >
              <blockquote className="text-[14px] leading-relaxed text-[#64748B]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-600">
                  {t.initials}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">{t.name}</p>
                  <p className="text-[12px] text-[#94A3B8]">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
