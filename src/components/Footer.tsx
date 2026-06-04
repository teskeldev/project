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
      { label: "Forum", href: "#" },
      { label: "Help", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Careers", href: "#" },
      { label: "Blog", href: "/blog" },
      { label: "Community", href: "#" },
      { label: "Students", href: "#" },
      { label: "Brand", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Data Use", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "X", href: "#" },
      { label: "LinkedIn", href: "#" },
      { label: "YouTube", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB]/60 px-6 py-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-semibold text-[#0F172A]">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-[13px] text-[#64748B] transition-colors hover:text-[#0F172A]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[#E5E7EB]/60 pt-6 sm:flex-row">
          <span className="text-[12px] text-[#94A3B8]">
            &copy; {new Date().getFullYear()} Teskel, Inc.
          </span>
          <span className="text-[12px] text-[#94A3B8]">SOC 2 Certified</span>
        </div>
      </div>
    </footer>
  );
}
