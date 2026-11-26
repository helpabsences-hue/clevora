import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FAMILY, registerFonts } from "@/lib/contracts/pdf";
import { formatDate, formatMoney } from "@/lib/format";
import { splitVat } from "./provider";

export type InvoiceData = {
  invoiceNumber: string;
  paidAt: string;
  reference: string;
  method: string;
  plan: string;
  period: "month" | "year";
  periodStart: string | null;
  periodEnd: string | null;
  amount: number;
  customer: { name: string; address: string | null; city: string | null; ice: string | null; rc: string | null; if_number: string | null };
};

const NAVY = "#1E3A5F";
const METHODS: Record<string, string> = { virement: "Virement bancaire", especes: "Espèces", cheque: "Chèque", carte: "Carte bancaire" };

/** Parcolia subscription invoice (Parcolia branding), generated on demand, never stored. */
export async function renderInvoicePdf(d: InvoiceData): Promise<Buffer> {
  registerFonts();
  const seller = {
    name: process.env.PARCOLIA_LEGAL_NAME || "Parcolia",
    address: process.env.PARCOLIA_LEGAL_ADDRESS || null,
    ice: process.env.PARCOLIA_ICE || null,
    rc: process.env.PARCOLIA_RC || null,
    email: process.env.PARCOLIA_BILLING_EMAIL || null,
  };
  const { ht, vat, ttc } = splitVat(d.amount);
  const s = StyleSheet.create({
    page: { fontFamily: FAMILY, fontSize: 10, padding: 40, color: "#0F172A" },
    top: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 10 },
    brand: { fontSize: 20, fontWeight: 700, color: NAVY },
    muted: { color: "#475569" },
    title: { fontSize: 14, fontWeight: 700, marginTop: 18, marginBottom: 2 },
    parties: { flexDirection: "row", gap: 16, marginTop: 16 },
    party: { flex: 1, borderWidth: 0.75, borderColor: "#CBD5E1", borderRadius: 4, padding: 8 },
    partyTitle: { fontSize: 8, color: "#475569", marginBottom: 4 },
    bold: { fontWeight: 700 },
    head: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 4, fontWeight: 700 },
    row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" },
    desc: { flex: 3 },
    num: { flex: 1, textAlign: "right" },
    totals: { marginTop: 10, marginLeft: "auto", width: 220 },
    totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
    grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: NAVY, paddingTop: 4, marginTop: 2, fontWeight: 700, fontSize: 12 },
    paid: { marginTop: 18, padding: 8, backgroundColor: "#ECFDF5", color: "#065F46", borderRadius: 4 },
    footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 7.5, color: "#94A3B8", textAlign: "center" },
  });
  const planLine = `Abonnement Parcolia — forfait ${d.plan} (${d.period === "year" ? "1 an" : "1 mois"})`;
  return renderToBuffer(
    <Document title={`Facture ${d.invoiceNumber}`} author="Parcolia" creator="Parcolia" producer="Parcolia">
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View>
            <Text style={s.brand}>Parcolia</Text>
            <Text style={s.muted}>Logiciel de gestion pour agences de location</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.bold}>Facture {d.invoiceNumber}</Text>
            <Text style={s.muted}>Date : {formatDate(d.paidAt)}</Text>
            <Text style={s.muted}>Référence : {d.reference}</Text>
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyTitle}>VENDEUR</Text>
            <Text style={s.bold}>{seller.name}</Text>
            {seller.address ? <Text>{seller.address}</Text> : null}
            {seller.ice ? <Text>ICE : {seller.ice}</Text> : null}
            {seller.rc ? <Text>RC : {seller.rc}</Text> : null}
            {seller.email ? <Text>{seller.email}</Text> : null}
          </View>
          <View style={s.party}>
            <Text style={s.partyTitle}>CLIENT</Text>
            <Text style={s.bold}>{d.customer.name}</Text>
            {d.customer.address ? <Text>{d.customer.address}</Text> : null}
            {d.customer.city ? <Text>{d.customer.city}</Text> : null}
            {d.customer.ice ? <Text>ICE : {d.customer.ice}</Text> : null}
            {d.customer.rc ? <Text>RC : {d.customer.rc}</Text> : null}
            {d.customer.if_number ? <Text>IF : {d.customer.if_number}</Text> : null}
          </View>
        </View>

        <View style={s.head}>
          <Text style={s.desc}>Désignation</Text>
          <Text style={s.num}>Montant HT</Text>
        </View>
        <View style={s.row}>
          <View style={s.desc}>
            <Text>{planLine}</Text>
            {d.periodStart && d.periodEnd ? (
              <Text style={s.muted}>
                Du {formatDate(d.periodStart)} au {formatDate(d.periodEnd)}
              </Text>
            ) : null}
          </View>
          <Text style={s.num}>{formatMoney(ht)}</Text>
        </View>

        <View style={s.totals}>
          <View style={s.totalLine}>
            <Text>Total HT</Text>
            <Text>{formatMoney(ht)}</Text>
          </View>
          <View style={s.totalLine}>
            <Text>TVA 20 %</Text>
            <Text>{formatMoney(vat)}</Text>
          </View>
          <View style={s.grand}>
            <Text>Total TTC</Text>
            <Text>{formatMoney(ttc)}</Text>
          </View>
        </View>

        <Text style={s.paid}>
          Payée le {formatDate(d.paidAt)} — {METHODS[d.method] ?? d.method}. Merci pour votre confiance.
        </Text>
        <Text style={s.footer} fixed>
          {seller.name} · Facture générée par Parcolia
        </Text>
      </Page>
    </Document>,
  );
}
