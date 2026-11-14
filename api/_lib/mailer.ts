import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | undefined;

/**
 * SMTP login for the company mailbox. Works with Google Workspace
 * (smtp.gmail.com, port 465, app password) or any other SMTP provider.
 */
export function mailer(): Transporter {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass)
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be set");
  const port = Number(process.env.SMTP_PORT || 465);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}

export const fromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_USER || "";
