import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Agents", href: "/#product" },
      { label: "Teams", href: "/enterprise" },
      { label: "Enterprise", href: "/enterprise" },
      { label: "Pricing", href: "/pricing" },
      { label: "Tab", href: "/#product" },
      { label: "CLI", href: "/download" },
      { label: "Cloud Agents", href: "/#product" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Download", href: "/download" },
      { label: "Changelog", href: "/changelog" },
      { label: "Docs", href: "/docs" },
      { label: "Learn", href: "/docs" },
      { label: "Help", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Data Use", href: "/privacy" },
      { label: "Security", href: "/docs" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "X", href: "#", external: true },
      { label: "LinkedIn", href: "#", external: true },
      { label: "YouTube", href: "#", external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border/60 px-6 py-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-semibold text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...("external" in link ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="text-[13px] text-text-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
          <span className="text-[12px] text-text-muted">
            &copy; {new Date().getFullYear()} Teskel, Inc.
          </span>
          <span className="text-[12px] text-text-muted">SOC 2 Certified</span>
        </div>
      </div>
    </footer>
  );
}
