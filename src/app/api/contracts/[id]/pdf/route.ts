import { NextResponse, type NextRequest } from "next/server";
import { getActiveAgency, getUser } from "@/lib/auth/session";
import { getContractData } from "@/lib/contracts/data";
import { renderContractPdf } from "@/lib/contracts/pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Contract PDF, generated on demand and never stored.
 * ?lang=ar adds Arabic labels next to the French ones; ?download=1 saves it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const agency = await getActiveAgency();
  if (!agency) return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const data = await getContractData(supabase, agency.id, id); // RLS: only this agency's rows
  if (!data) return new NextResponse("Not found", { status: 404 });

  const arabic = request.nextUrl.searchParams.get("lang") === "ar";
  const pdf = await renderContractPdf(data, arabic);
  const filename = `contrat-${data.reservation.contract_number.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.get("download") ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
