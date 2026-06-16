"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Users,
  BarChart3,
  Lock,
  Server,
  Headphones,
  Zap,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Enterprise-grade security",
    description:
      "SOC 2 Type II certified. Zero data retention mode. Your code never leaves your infrastructure.",
  },
  {
    icon: Users,
    title: "Team management",
    description:
      "Centralized admin dashboard with role-based access control, SSO, and SAML integration.",
  },
  {
    icon: BarChart3,
    title: "Usage analytics",
    description:
      "Track adoption, productivity gains, and ROI across your organization with detailed analytics.",
  },
  {
    icon: Lock,
    title: "SSO & SAML",
    description:
      "Single sign-on with Okta, Azure AD, Google Workspace, and any SAML 2.0 provider.",
  },
  {
    icon: Server,
    title: "Self-hosted option",
    description:
      "Deploy Teskel on your own infrastructure for maximum control and compliance.",
  },
  {
    icon: Headphones,
    title: "Dedicated support",
    description:
      "Priority support with dedicated customer success manager and SLA guarantees.",
  },
  {
    icon: Zap,
    title: "Custom models",
    description:
      "Fine-tune models on your codebase for more accurate and relevant suggestions.",
  },
  {
    icon: Globe,
    title: "Global deployment",
    description:
      "Multi-region deployment options to meet data residency and latency requirements.",
  },
];

const logos = [
  "Fortune 500 Tech",
  "Global Bank",
  "Healthcare Corp",
  "Auto Manufacturer",
  "Retail Giant",
  "Telecom Leader",
];

export default function EnterprisePage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <span className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600">
            Enterprise
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Teskel for your
            <br />
            entire organization
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Deploy AI-powered coding across your engineering team with
            enterprise security, compliance, and admin controls.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="#contact"
              className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Contact sales
            </Link>
            <Link
              href="#demo"
              className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Request a demo
            </Link>
          </div>
        </motion.div>

        {/* Trusted by */}
        <div className="mb-20">
          <p className="mb-8 text-center text-sm font-medium text-gray-500">
            Trusted by engineering teams at
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {logos.map((logo) => (
              <div
                key={logo}
                className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-4"
              >
                <span className="text-sm font-semibold text-gray-400">
                  {logo}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-gray-200/80 bg-white/80 p-6"
            >
              <div className="mb-3 inline-flex rounded-lg bg-blue-50 p-2.5">
                <feature.icon size={20} className="text-blue-600" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-600">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 rounded-2xl bg-gray-900 p-12"
        >
          <div className="grid gap-8 text-center sm:grid-cols-4">
            {[
              { value: "40%", label: "Faster development" },
              { value: "10M+", label: "Lines of code generated" },
              { value: "500+", label: "Enterprise customers" },
              { value: "99.9%", label: "Uptime SLA" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Demo section */}
        <section id="demo" className="mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-gray-200 bg-white p-12 text-center"
          >
            <h2 className="text-3xl font-semibold text-gray-900">
              See Teskel in action
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-gray-600">
              Schedule a personalized demo with our team to see how Teskel can
              accelerate your engineering organization.
            </p>
            <Link
              href="#contact"
              className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Schedule a demo
            </Link>
          </motion.div>
        </section>

        {/* Contact / CTA */}
        <section id="contact" className="mt-20 text-center">
          <h2 className="text-3xl font-semibold text-gray-900">
            Ready to transform your team?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-600">
            Get started with a free pilot for your engineering team. No credit
            card required.
          </p>
          <Link
            href="mailto:sales@teskel.com"
            className="mt-8 inline-block rounded-xl bg-gray-900 px-8 py-3.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Talk to sales
          </Link>
        </section>
      </div>
    </div>
  );
}
