import "server-only";

export type PaymentMethod = "virement" | "especes" | "cheque" | "carte";

export type PaymentInstructions = {
  /** Lines to show the admin (bank, RIB, who to call), already in French/plain words. */
  bankName: string | null;
  rib: string | null;
  beneficiary: string;
  phone: string | null;
  email: string | null;
};

/**
 * How an agency pays Parcolia. Today: manual payment (transfer, cash, cheque)
 * confirmed by Parcolia in /platform. A card provider (CMI, Stripe...) can
 * implement the same interface later and confirm payments from its webhook.
 */
export interface PaymentProvider {
  code: string;
  methods: PaymentMethod[];
  instructions(): PaymentInstructions;
}

export class ManualPaymentProvider implements PaymentProvider {
  code = "manual";
  methods: PaymentMethod[] = ["virement", "especes", "cheque"];
  instructions(): PaymentInstructions {
    return {
      bankName: process.env.PARCOLIA_BANK_NAME || null,
      rib: process.env.PARCOLIA_BANK_RIB || null,
      beneficiary: process.env.PARCOLIA_LEGAL_NAME || "Parcolia",
      phone: process.env.PARCOLIA_BILLING_PHONE || null,
      email: process.env.PARCOLIA_BILLING_EMAIL || null,
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}

/** Morocco VAT on the subscription (prices are shown all taxes included). */
export const VAT_RATE = 0.2;

export function splitVat(ttc: number): { ht: number; vat: number; ttc: number } {
  const ht = Math.round((ttc / (1 + VAT_RATE)) * 100) / 100;
  return { ht, vat: Math.round((ttc - ht) * 100) / 100, ttc };
}
