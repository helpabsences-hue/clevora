import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/billing/invoice-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Invoice PDF of a paid subscription payment. RLS lets the agency's admins and
 * Parcolia (platform) read the payment; nobody else gets a row.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  if (!(await getUser())) return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("subscription_payments")
    .select("invoice_number, paid_at, reference, method, period, period_start, period_end, amount, status, plan:plans(name), agency:agencies(name, address, city, ice, rc, if_number)")
    .eq("id", id)
    .maybeSingle();
  if (!p || p.status !== "paid" || !p.invoice_number || !p.paid_at || !p.agency || !p.plan) return new NextResponse("Not found", { status: 404 });
  const pdf = await renderInvoicePdf({
    invoiceNumber: p.invoice_number,
    paidAt: p.paid_at,
    reference: p.reference,
    method: p.method,
    plan: p.plan.name,
    period: p.period as "month" | "year",
    periodStart: p.period_start,
    periodEnd: p.period_end,
    amount: Number(p.amount),
    customer: p.agency,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${p.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
