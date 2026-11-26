import "server-only";
import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/env.server";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** One interface for every outgoing email, so the provider can be swapped. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** SMTP: the local Supabase mailbox (Mailpit) in development, Resend SMTP in production. */
class SmtpEmailSender implements EmailSender {
  private transport = (() => {
    const env = serverEnv();
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
    });
  })();

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: serverEnv().EMAIL_FROM, ...message });
  }
}

let sender: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  sender ??= new SmtpEmailSender();
  return sender;
}
