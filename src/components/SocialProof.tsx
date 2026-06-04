export default function SocialProof() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-center text-[15px] font-medium text-[#64748B]">
          Trusted every day by teams that build world-class software
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {["OpenAI", "Stripe", "NVIDIA", "Shopify", "Datadog", "Linear", "Vercel", "Figma"].map((name) => (
            <span
              key={name}
              className="text-[18px] font-semibold tracking-tight text-gray-400/80 transition-colors hover:text-gray-600"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
