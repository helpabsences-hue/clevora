import "server-only";
import type { Locale } from "@/i18n/routing";
import { getEmailSender } from "@/lib/email/sender";
import type { AlertDigest } from "./compute";
import { renderDigestEmail } from "./email";

export type Recipient = { name: string | null; email: string | null; phone: string | null; locale: Locale };
export type DigestContext = { agencyName: string; brandColor: string; appUrl: string };

/**
 * A way to deliver the daily alert summary. Email is implemented; a WhatsApp
 * channel (WhatsApp Business API) can be added later with the same shape.
 */
export interface AlertChannel {
  readonly name: "email" | "whatsapp";
  canReach(recipient: Recipient): boolean;
  send(recipient: Recipient, digest: AlertDigest, ctx: DigestContext): Promise<void>;
}

export class EmailAlertChannel implements AlertChannel {
  readonly name = "email" as const;
  canReach(r: Recipient) {
    return Boolean(r.email);
  }
  async send(r: Recipient, digest: AlertDigest, ctx: DigestContext) {
    const mail = renderDigestEmail(digest, { ...ctx, locale: r.locale, name: r.name });
    await getEmailSender().send({ to: r.email!, ...mail });
  }
}

export function alertChannels(): AlertChannel[] {
  return [new EmailAlertChannel()];
}
