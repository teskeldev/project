import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Teskel",
  description: "Teskel Terms of Service — the rules governing use of our AI-powered coding platform.",
};

export default function TermsPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last updated: June 1, 2026
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-gray-700">
          {/* 1. Acceptance */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Teskel (&quot;the Service&quot;), operated by Teskel, Inc.
              (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of
              Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not
              access or use the Service.
            </p>
            <p className="mt-3">
              These Terms apply to all visitors, users, and others who access or use
              the Service, including individual users and organizations that create
              workspaces.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              2. Description of Service
            </h2>
            <p>
              Teskel is an AI-powered software development platform that provides
              intelligent code completion, autonomous coding agents, collaborative
              editing, terminal access, version control integration, and related
              developer tools. The Service may include free and paid tiers with
              varying feature sets and usage limits.
            </p>
          </section>

          {/* 3. User Accounts */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              3. User Accounts
            </h2>
            <p>
              To use certain features of the Service, you must create an account. You
              are responsible for maintaining the confidentiality of your account
              credentials and for all activities that occur under your account.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>You must provide accurate and complete registration information.</li>
              <li>You must be at least 16 years old to create an account.</li>
              <li>
                You are responsible for notifying us immediately of any unauthorized
                use of your account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate
                these Terms.
              </li>
            </ul>
          </section>

          {/* 4. Acceptable Use Policy */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              4. Acceptable Use Policy
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                Violate any applicable laws, regulations, or third-party rights.
              </li>
              <li>
                Generate, store, or distribute malicious code, malware, or exploits
                intended to harm systems or individuals.
              </li>
              <li>
                Attempt to gain unauthorized access to other users&apos; accounts,
                workspaces, or data.
              </li>
              <li>
                Use the AI features to generate content that is illegal, harmful,
                threatening, abusive, or discriminatory.
              </li>
              <li>
                Circumvent usage limits, rate limits, or access controls through
                automated means.
              </li>
              <li>
                Reverse-engineer, decompile, or attempt to extract the source code of
                the Service.
              </li>
              <li>
                Resell, sublicense, or redistribute access to the Service without
                written permission.
              </li>
            </ul>
          </section>

          {/* 5. Intellectual Property */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              5. Intellectual Property
            </h2>
            <p>
              The Service, including its original content, features, and
              functionality, is owned by Teskel, Inc. and is protected by
              international copyright, trademark, patent, trade secret, and other
              intellectual property laws.
            </p>
            <p className="mt-3">
              You retain all rights to the code, content, and materials you create
              using the Service (&quot;Your Content&quot;). By using the Service, you grant us
              a limited license to process Your Content solely for the purpose of
              providing and improving the Service.
            </p>
          </section>

          {/* 6. AI-Generated Content */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              6. AI-Generated Content
            </h2>
            <p>
              The Service uses artificial intelligence to generate code suggestions,
              completions, and other outputs (&quot;AI Output&quot;). You acknowledge that:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                AI Output is generated algorithmically and may not always be accurate,
                complete, or suitable for your intended purpose.
              </li>
              <li>
                You are solely responsible for reviewing, testing, and validating any
                AI Output before using it in production systems.
              </li>
              <li>
                AI Output may occasionally resemble publicly available code. You are
                responsible for ensuring compliance with applicable licenses.
              </li>
              <li>
                We do not claim ownership of AI Output generated in response to your
                prompts. Subject to these Terms, you own the AI Output you generate.
              </li>
              <li>
                We may use anonymized, aggregated usage patterns to improve our AI
                models, but we will not use your proprietary code for training without
                explicit consent.
              </li>
            </ul>
          </section>

          {/* 7. Data Privacy */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              7. Data Privacy
            </h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <a href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
              , which describes how we collect, use, and protect your personal
              information. By using the Service, you consent to the data practices
              described in the Privacy Policy.
            </p>
          </section>

          {/* 8. Payment Terms */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              8. Payment Terms
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Paid plans are billed in advance on a monthly or annual basis,
                depending on the billing cycle you select.
              </li>
              <li>
                All fees are non-refundable except as required by applicable law or as
                explicitly stated in these Terms.
              </li>
              <li>
                We may change pricing with 30 days&apos; notice. Price changes will take
                effect at the start of your next billing cycle.
              </li>
              <li>
                If payment fails, we may suspend access to paid features after a
                grace period of 7 days.
              </li>
              <li>
                You are responsible for all applicable taxes associated with your use
                of the Service.
              </li>
            </ul>
          </section>

          {/* 9. Limitation of Liability */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              9. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TESKEL, INC. SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA,
              USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE
              SERVICE.
            </p>
            <p className="mt-3">
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT
              EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE
              CLAIM, OR $100, WHICHEVER IS GREATER.
            </p>
            <p className="mt-3">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
              OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              AND NON-INFRINGEMENT.
            </p>
          </section>

          {/* 10. Termination */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              10. Termination
            </h2>
            <p>
              You may terminate your account at any time by contacting us or using the
              account deletion feature in your settings. We may terminate or suspend
              your access immediately, without prior notice, for conduct that we
              believe violates these Terms or is harmful to other users, us, or third
              parties.
            </p>
            <p className="mt-3">
              Upon termination, your right to use the Service will immediately cease.
              We will make your data available for export for 30 days following
              termination, after which it may be permanently deleted.
            </p>
          </section>

          {/* 11. Changes to Terms */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              11. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide
              notice of material changes by posting the updated Terms on the Service
              and updating the &quot;Last updated&quot; date. Your continued use of the Service
              after changes become effective constitutes acceptance of the revised
              Terms.
            </p>
          </section>

          {/* 12. Contact Information */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              12. Contact Information
            </h2>
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                <strong>Email:</strong> legal@teskel.com
              </li>
              <li>
                <strong>Address:</strong> Teskel, Inc., 548 Market St, Suite 35000,
                San Francisco, CA 94104
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
