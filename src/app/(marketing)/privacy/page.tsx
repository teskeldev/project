import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Teskel",
  description: "Teskel Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last updated: June 1, 2026
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-gray-700">
          {/* 1. Information We Collect */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              1. Information We Collect
            </h2>
            <p>We collect information in the following ways:</p>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-800">
              Information you provide
            </h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Account information: name, email address, and profile details when
                you create an account.
              </li>
              <li>
                Payment information: billing address and payment method details
                (processed securely by Stripe; we do not store full card numbers).
              </li>
              <li>
                Content: code, files, chat messages, and other content you create or
                upload to the Service.
              </li>
              <li>
                Communications: messages you send to our support team or feedback you
                provide.
              </li>
            </ul>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-800">
              Information collected automatically
            </h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Usage data: features used, actions taken, timestamps, and performance
                metrics.
              </li>
              <li>
                Device information: browser type, operating system, device
                identifiers, and screen resolution.
              </li>
              <li>
                Network information: IP address, referral URLs, and general location
                (city/country level).
              </li>
              <li>
                Log data: server logs including request timestamps, endpoints
                accessed, and response codes.
              </li>
            </ul>
          </section>

          {/* 2. How We Use Information */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              2. How We Use Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Provide, maintain, and improve the Service.</li>
              <li>
                Process transactions and send related billing notifications.
              </li>
              <li>
                Provide AI-powered features including code completion, agent
                execution, and intelligent suggestions.
              </li>
              <li>
                Send service-related communications (security alerts, updates,
                support messages).
              </li>
              <li>
                Detect, prevent, and address technical issues, fraud, and security
                threats.
              </li>
              <li>
                Analyze usage patterns to improve product features and user
                experience.
              </li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
            </ul>
          </section>

          {/* 3. Data Storage & Security */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              3. Data Storage &amp; Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                All data is encrypted in transit (TLS 1.3) and at rest (AES-256).
              </li>
              <li>
                Infrastructure is hosted on SOC 2 Type II certified cloud providers.
              </li>
              <li>
                Access to production systems is restricted and audited with
                role-based access controls.
              </li>
              <li>
                Regular security assessments, penetration testing, and vulnerability
                scanning are performed.
              </li>
              <li>
                Database backups are encrypted and stored in geographically separate
                regions.
              </li>
            </ul>
            <p className="mt-3">
              While we strive to protect your data, no method of electronic
              transmission or storage is 100% secure. We cannot guarantee absolute
              security.
            </p>
          </section>

          {/* 4. AI Data Processing */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              4. AI Data Processing
            </h2>
            <p>
              Our AI features process your code and content to provide intelligent
              suggestions. Here&apos;s how we handle AI-related data:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Code context:</strong> When you use AI features, relevant
                portions of your code are sent to our AI infrastructure to generate
                responses. This data is processed in real-time and not persistently
                stored beyond the session.
              </li>
              <li>
                <strong>Model training:</strong> We do NOT use your private code or
                proprietary content to train our AI models without your explicit
                opt-in consent.
              </li>
              <li>
                <strong>Telemetry:</strong> We may collect anonymized, aggregated
                metrics about AI feature usage (e.g., acceptance rates, latency) to
                improve the Service.
              </li>
              <li>
                <strong>Third-party AI providers:</strong> Some AI features may use
                third-party model providers (e.g., OpenAI, Anthropic). Data sent to
                these providers is governed by their respective data processing
                agreements and our contractual obligations with them.
              </li>
              <li>
                <strong>Enterprise controls:</strong> Enterprise customers can
                configure data residency requirements and opt out of all telemetry
                collection.
              </li>
            </ul>
          </section>

          {/* 5. Third-Party Services */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              5. Third-Party Services
            </h2>
            <p>
              We use the following categories of third-party services to operate the
              platform:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Payment processing:</strong> Stripe (PCI DSS Level 1
                compliant).
              </li>
              <li>
                <strong>Authentication:</strong> OAuth providers (GitHub, Google) for
                social sign-in.
              </li>
              <li>
                <strong>Cloud infrastructure:</strong> For hosting, storage, and
                compute services.
              </li>
              <li>
                <strong>Analytics:</strong> Privacy-focused analytics to understand
                product usage.
              </li>
              <li>
                <strong>Email:</strong> Transactional email services for
                notifications and communications.
              </li>
            </ul>
            <p className="mt-3">
              Each third-party service is bound by data processing agreements that
              require them to protect your data in accordance with applicable privacy
              laws.
            </p>
          </section>

          {/* 6. Cookies */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              6. Cookies
            </h2>
            <p>We use cookies and similar technologies for:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Essential cookies:</strong> Required for authentication,
                security, and core functionality. These cannot be disabled.
              </li>
              <li>
                <strong>Preference cookies:</strong> Remember your settings such as
                theme, language, and editor preferences.
              </li>
              <li>
                <strong>Analytics cookies:</strong> Help us understand how the
                Service is used. These can be disabled in your account settings.
              </li>
            </ul>
            <p className="mt-3">
              We do not use advertising cookies or sell data to advertisers. You can
              manage cookie preferences through your browser settings or our in-app
              cookie controls.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              7. Your Rights (GDPR/CCPA)
            </h2>
            <p>
              Depending on your location, you may have the following rights regarding
              your personal data:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Access:</strong> Request a copy of the personal data we hold
                about you.
              </li>
              <li>
                <strong>Rectification:</strong> Request correction of inaccurate or
                incomplete data.
              </li>
              <li>
                <strong>Erasure:</strong> Request deletion of your personal data
                (&quot;right to be forgotten&quot;).
              </li>
              <li>
                <strong>Portability:</strong> Request your data in a structured,
                machine-readable format.
              </li>
              <li>
                <strong>Restriction:</strong> Request that we limit processing of
                your data in certain circumstances.
              </li>
              <li>
                <strong>Objection:</strong> Object to processing based on legitimate
                interests.
              </li>
              <li>
                <strong>Non-discrimination:</strong> We will not discriminate against
                you for exercising your privacy rights (CCPA).
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at privacy@teskel.com. We
              will respond within 30 days (or as required by applicable law).
            </p>
            <p className="mt-3">
              <strong>For California residents:</strong> We do not sell personal
              information as defined by the CCPA. You may designate an authorized
              agent to make requests on your behalf.
            </p>
          </section>

          {/* 8. Data Retention */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              8. Data Retention
            </h2>
            <p>We retain your data according to the following guidelines:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Account data:</strong> Retained for the duration of your
                account plus 30 days after deletion.
              </li>
              <li>
                <strong>Project content:</strong> Retained while your account is
                active. Deleted within 30 days of account termination.
              </li>
              <li>
                <strong>Usage logs:</strong> Retained for up to 90 days for
                operational purposes.
              </li>
              <li>
                <strong>Billing records:</strong> Retained for 7 years as required by
                tax and financial regulations.
              </li>
              <li>
                <strong>AI interaction logs:</strong> Session-level context is not
                persistently stored. Aggregated metrics are retained for up to 12
                months.
              </li>
            </ul>
          </section>

          {/* 9. Children's Privacy */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              9. Children&apos;s Privacy
            </h2>
            <p>
              The Service is not directed to children under 16 years of age. We do
              not knowingly collect personal information from children under 16. If
              we become aware that we have collected personal data from a child under
              16 without parental consent, we will take steps to delete that
              information promptly.
            </p>
            <p className="mt-3">
              If you are a parent or guardian and believe your child has provided us
              with personal information, please contact us at privacy@teskel.com.
            </p>
          </section>

          {/* 10. Changes to Policy */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you
              of material changes by posting the updated policy on the Service,
              sending an email notification, or displaying a prominent notice within
              the application.
            </p>
            <p className="mt-3">
              We encourage you to review this policy periodically. Your continued use
              of the Service after changes become effective constitutes acceptance of
              the revised policy.
            </p>
          </section>

          {/* 11. Contact */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              11. Contact
            </h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our data
              practices, please contact us:
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                <strong>Email:</strong> privacy@teskel.com
              </li>
              <li>
                <strong>Data Protection Officer:</strong> dpo@teskel.com
              </li>
              <li>
                <strong>Address:</strong> Teskel, Inc., 548 Market St, Suite 35000,
                San Francisco, CA 94104
              </li>
            </ul>
            <p className="mt-3">
              If you are in the EU/EEA and believe we have not adequately addressed
              your concerns, you have the right to lodge a complaint with your local
              data protection authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
