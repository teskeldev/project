/**
 * Email service using Resend API via fetch (no SDK dependency).
 *
 * Required env vars:
 *   RESEND_API_KEY – Resend API key
 *   EMAIL_FROM – Sender address (e.g. "Teskel <noreply@teskel.com>")
 *   NEXT_PUBLIC_APP_URL – Base URL for links in emails (e.g. "https://teskel.com")
 */

const RESEND_API_URL = "https://api.resend.com/emails";

// Fail fast in production: email links must point at a real public URL, not
// the dev default of http://localhost:3000. Falling back silently to localhost
// in production would generate password-reset / verification emails that go
// nowhere, locking users out.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_APP_URL
) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL must be set in production so email links " +
    "(verification, password reset, invites) point at the real site."
  );
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Escapes HTML special characters to prevent XSS when interpolating user data
 * into HTML email templates.
 */
function escapeHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Strips CR, LF, tab, and other ASCII control characters from a string before
 * it is used as an RFC 822 email subject. This prevents header injection
 * attacks where a user-controlled value (e.g. a workspace name) could
 * terminate the subject header and inject new headers or a malicious body.
 */
function sanitizeSubject(input: string): string {
  if (!input) return "";
  return input.replace(/[\x00-\x1f\x7f]/g, "");
}

/**
 * Sends an email via the Resend API.
 * Returns true if the email was sent successfully, false if the API key is not
 * configured (development/test environments). Throws an error if the API
 * request fails so callers can handle delivery failures.
 */
async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Teskel <noreply@teskel.com>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured – skipping email send");
    return false;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown error");
    throw new Error(`[email] Failed to send email to ${to}: ${res.status} ${body}`);
  }

  return true;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Send email verification link.
 * Returns true if sent, false if email is not configured.
 * Throws on delivery failure.
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to: email,
    subject: "Verify your email – Teskel",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">Verify your email</h1>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
          Click the button below to verify your email address and activate your Teskel account.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Verify Email
        </a>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
          If you didn't create an account, you can safely ignore this email. This link expires in 24 hours.
        </p>
      </div>
    `,
  });
}

/**
 * Send password reset link.
 * Returns true if sent, false if email is not configured.
 * Throws on delivery failure.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to: email,
    subject: "Reset your password – Teskel",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">Reset your password</h1>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
          If you didn't request a password reset, you can safely ignore this email. This link expires in 1 hour.
        </p>
      </div>
    `,
  });
}

/**
 * Send welcome email after successful registration.
 * Returns true if sent, false if email is not configured.
 * Throws on delivery failure.
 */
export async function sendWelcomeEmail(
  email: string,
  name?: string | null
): Promise<boolean> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const greeting = name ? `Hi ${escapeHtml(name)}` : "Welcome";

  return sendEmail({
    to: email,
    subject: "Welcome to Teskel!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">${greeting}!</h1>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
          Your Teskel account is ready. Start building amazing projects with AI-powered development tools.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Go to Dashboard
        </a>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
          If you have any questions, feel free to reach out to our support team.
        </p>
      </div>
    `,
  });
}

/**
 * Send team invite email when a user is added to a workspace.
 * Returns true if sent, false if email is not configured.
 * Throws on delivery failure.
 */
export async function sendTeamInviteEmail(
  email: string,
  opts: {
    workspaceName: string;
    inviterName?: string | null;
    role: string;
  }
): Promise<boolean> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const inviterLabel = opts.inviterName ? escapeHtml(opts.inviterName) : "A team member";
  const safeWorkspaceName = escapeHtml(opts.workspaceName);
  const safeSubjectWorkspaceName = sanitizeSubject(opts.workspaceName);
  const safeRole = escapeHtml(opts.role.toLowerCase());

  return sendEmail({
    to: email,
    subject: `You've been invited to ${safeSubjectWorkspaceName} – Teskel`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">You're invited!</h1>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
          ${inviterLabel} has invited you to join <strong>${safeWorkspaceName}</strong> as a <strong>${safeRole}</strong> on Teskel.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Open Teskel
        </a>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
          If you don't have a Teskel account yet, you'll be prompted to create one when you click the link above.
        </p>
      </div>
    `,
  });
}
