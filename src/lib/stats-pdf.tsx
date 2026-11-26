import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FAMILY, registerFonts } from "@/lib/contracts/pdf";
import { formatDate, formatMoney } from "@/lib/format";
import type { Bucket } from "@/lib/stats";

type Car = { brand_model: string; plate: string; revenue: number; charges: number; net: number; rented_days: number; occupancy: number };

/** Statistics report with the agency branding, generated on demand. */
export async function renderStatsPdf(input: {
  agencyName: string;
  brand: string;
  from: string;
  to: string;
  totals: { revenue: number; charges: number; damages: number; rentedDays: number; occupancy: number };
  buckets: Array<Bucket & { label: string }>;
  cars: Car[];
}): Promise<Buffer> {
  registerFonts();
  const s = StyleSheet.create({
    page: { fontFamily: FAMILY, fontSize: 9, padding: 30, paddingBottom: 40, color: "#0F172A" },
    h1: { fontSize: 16, fontWeight: 700, color: input.brand },
    muted: { color: "#475569" },
    tiles: { flexDirection: "row", gap: 6, marginVertical: 12 },
    tile: { flex: 1, borderWidth: 0.75, borderColor: "#CBD5E1", borderRadius: 4, padding: 6 },
    tileValue: { fontSize: 12, fontWeight: 700 },
    h2: { fontSize: 11, fontWeight: 700, color: input.brand, marginTop: 10, marginBottom: 4 },
    row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0", paddingVertical: 3 },
    head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: input.brand, paddingVertical: 3, fontWeight: 700 },
    c1: { flex: 2 },
    cN: { flex: 1, textAlign: "right" },
    footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94A3B8" },
  });
  const net = input.totals.revenue + input.totals.damages - input.totals.charges;
  return renderToBuffer(
    <Document title={`Statistiques ${input.agencyName}`} author={input.agencyName} creator="Parcolia" producer="Parcolia">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{input.agencyName} · Statistiques</Text>
        <Text style={s.muted}>
          Période du {formatDate(input.from)} au {formatDate(input.to)}
        </Text>
        <View style={s.tiles}>
          {[
            ["Chiffre d'affaires", formatMoney(input.totals.revenue)],
            ["Frais de dégâts", formatMoney(input.totals.damages)],
            ["Charges", formatMoney(input.totals.charges)],
            ["Bénéfice net", formatMoney(net)],
            ["Jours loués", String(input.totals.rentedDays)],
            ["Occupation", `${input.totals.occupancy} %`],
          ].map(([label, value]) => (
            <View key={label} style={s.tile}>
              <Text style={s.muted}>{label}</Text>
              <Text style={s.tileValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Par période</Text>
        <View style={s.head}>
          <Text style={s.c1}>Période</Text>
          <Text style={s.cN}>Chiffre d&apos;affaires</Text>
          <Text style={s.cN}>Charges</Text>
          <Text style={s.cN}>Net</Text>
        </View>
        {input.buckets.map((b) => (
          <View key={b.key} style={s.row} wrap={false}>
            <Text style={s.c1}>{b.label}{b.partial ? " (partiel)" : ""}</Text>
            <Text style={s.cN}>{formatMoney(b.revenue)}</Text>
            <Text style={s.cN}>{formatMoney(b.charges)}</Text>
            <Text style={s.cN}>{formatMoney(b.net)}</Text>
          </View>
        ))}
        <Text style={s.h2}>Performance par voiture</Text>
        <View style={s.head}>
          <Text style={s.c1}>Voiture</Text>
          <Text style={s.cN}>CA</Text>
          <Text style={s.cN}>Charges</Text>
          <Text style={s.cN}>Net</Text>
          <Text style={s.cN}>Jours</Text>
          <Text style={s.cN}>Occupation</Text>
        </View>
        {input.cars.map((c) => (
          <View key={c.plate} style={s.row} wrap={false}>
            <Text style={s.c1}>{c.brand_model} · {c.plate}</Text>
            <Text style={s.cN}>{formatMoney(c.revenue)}</Text>
            <Text style={s.cN}>{formatMoney(c.charges)}</Text>
            <Text style={s.cN}>{formatMoney(c.net)}</Text>
            <Text style={s.cN}>{c.rented_days}</Text>
            <Text style={s.cN}>{c.occupancy} %</Text>
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text>{input.agencyName}</Text>
          <Text>Propulsé par Parcolia</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>,
  );
}
