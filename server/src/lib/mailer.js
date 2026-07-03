import nodemailer from "nodemailer";
import { config } from "../config.js";

// A single transporter targeting SMTP (MailHog in dev). If SMTP is unreachable
// the send will reject, and the notification pipeline records the failure.
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const info = await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  });
  return info.messageId;
}
