import "server-only";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { ContractData, ContractDriver } from "./data";
import { LABELS, type LabelKey } from "./labels";

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
let fontsRegistered = false;
export function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSans-Regular.woff") },
      { src: path.join(FONT_DIR, "NotoSans-Bold.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "NotoSansArabic",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSansArabic-Regular.woff") },
      { src: path.join(FONT_DIR, "NotoSansArabic-Bold.woff"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/** Latin first, Arabic glyphs fall back to Noto Sans Arabic (names, addresses, labels). */
export const FAMILY = ["NotoSans", "NotoSansArabic"];

function styles(brand: string, compact: boolean) {
  const gap = compact ? 4 : 7;
  return StyleSheet.create({
    page: { fontFamily: FAMILY, fontSize: compact ? 7.8 : 8.5, color: "#0F172A", paddingTop: compact ? 22 : 28, paddingBottom: 36, paddingHorizontal: 28 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 2, borderBottomColor: brand, paddingBottom: 8 },
    logo: { width: 44, height: 44, objectFit: "contain" },
    logoBox: { width: 44, height: 44, borderRadius: 6, backgroundColor: brand, color: "#FFFFFF", fontSize: 20, fontWeight: 700, textAlign: "center", paddingTop: 9 },
    agencyName: { fontSize: 14, fontWeight: 700 },
    muted: { color: "#475569" },
    small: { fontSize: 7.5, color: "#475569" },
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 8 },
    title: { fontSize: 13, fontWeight: 700, color: brand },
    number: { fontSize: 13, fontWeight: 700, borderWidth: 1.5, borderColor: brand, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
    row: { flexDirection: "row", gap: 8 },
    col: { flex: 1 },
    box: { borderWidth: 0.75, borderColor: "#CBD5E1", borderRadius: 4, padding: compact ? 5 : 6, marginBottom: gap },
    boxTitle: { fontSize: 9, fontWeight: 700, color: brand, marginBottom: 4 },
    line: { flexDirection: "row", marginBottom: compact ? 3.5 : 2.5, gap: 4 },
    label: { width: "40%", color: "#475569" },
    value: { width: "60%", fontWeight: 700 },
    priceLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2.5 },
    totalLine: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.75, borderTopColor: "#CBD5E1", paddingTop: 3, marginTop: 2, fontWeight: 700, fontSize: 10 },
    signBox: { flex: 1, height: compact ? 58 : 70, borderWidth: 0.75, borderColor: "#94A3B8", borderRadius: 4, padding: 6 },
    footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94A3B8" },
    terms: { fontSize: 8.5, lineHeight: 1.45 },
  });
}

type Styles = ReturnType<typeof styles>;

function L({ k, ar, style, stack }: { k: LabelKey; ar: boolean; style?: Style | Style[]; stack?: boolean }) {
  const [fr, arabic] = LABELS[k];
  if (ar && stack) {
    // Field labels: Arabic under the French label so long labels never touch the value
    return (
      <View style={style}>
        <Text>{fr}</Text>
        <Text style={{ fontFamily: "NotoSansArabic", fontSize: 6.5, lineHeight: 1.35, marginTop: 1 }}>{arabic}</Text>
      </View>
    );
  }
  return (
    <Text style={style}>
      {fr}
      {ar ? <Text style={{ fontFamily: "NotoSansArabic" }}>{`  ${arabic}`}</Text> : null}
    </Text>
  );
}

function Line({ s, k, ar, value }: { s: Styles; k: LabelKey; ar: boolean; value: string | null | undefined }) {
  return (
    <View style={s.line} wrap={false}>
      <L k={k} ar={ar} style={s.label} stack />
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

function DriverBox({ s, d, title, ar }: { s: Styles; d: ContractDriver; title: LabelKey; ar: boolean }) {
  const idLabel: LabelKey = d.id_type === "passport" ? "passport" : "cin";
  return (
    <View style={[s.box, s.col]} wrap={false}>
      <L k={title} ar={ar} style={s.boxTitle} />
      <Line s={s} k="name" ar={ar} value={d.full_name} />
      <Line s={s} k="birth" ar={ar} value={[formatDate(d.birth_date), d.birth_place].filter(Boolean).join(" · ")} />
      <Line s={s} k="nationality" ar={ar} value={d.nationality} />
      <Line s={s} k="address" ar={ar} value={d.address} />
      <Line s={s} k="phone" ar={ar} value={formatPhone(d.phone)} />
      <Line s={s} k={idLabel} ar={ar} value={[d.id_number, d.id_expires_on ? `(${LABELS.validUntil[0]} ${formatDate(d.id_expires_on)})` : ""].filter(Boolean).join(" ")} />
      <Line s={s} k="license" ar={ar} value={d.license_number} />
      <Line s={s} k="licenseIssued" ar={ar} value={[formatDate(d.license_issued_on), d.license_issued_place].filter(Boolean).join(" · ")} />
    </View>
  );
}

function Footer({ s, ar, agency }: { s: Styles; ar: boolean; agency: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{agency}</Text>
      <L k="poweredBy" ar={ar} />
      <Text render={({ pageNumber, totalPages }) => `${LABELS.page[0]} ${pageNumber}/${totalPages}`} />
    </View>
  );
}

export function ContractDocument({ data, arabic, logo }: { data: ContractData; arabic: boolean; logo: Buffer | null }) {
  const { reservation: r, totals, agency } = data;
  const s = styles(agency.brand, arabic);
  const fuel = (q: number | null) => (q === null ? "—" : `${q}/4`);
  const legal = [
    agency.rc && `RC ${agency.rc}`,
    agency.ice && `ICE ${agency.ice}`,
    agency.if_number && `IF ${agency.if_number}`,
    agency.patente && `Patente ${agency.patente}`,
    agency.cnss && `CNSS ${agency.cnss}`,
  ].filter(Boolean);

  return (
    <Document title={`${LABELS.title[0]} ${r.contract_number}`} author={agency.name} creator="Parcolia" producer="Parcolia">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.logoBox}>{agency.name.trim().charAt(0).toUpperCase()}</Text>}
          <View style={s.col}>
            <Text style={s.agencyName}>{agency.name}</Text>
            <Text style={s.muted}>{[agency.address, agency.city].filter(Boolean).join(", ")}</Text>
            <Text style={s.muted}>{[formatPhone(agency.phone), agency.email].filter(Boolean).join(" · ")}</Text>
            {legal.length ? <Text style={s.small}>{legal.join(" · ")}</Text> : null}
          </View>
        </View>

        <View style={s.titleRow}>
          <L k="title" ar={arabic} style={s.title} />
          <Text style={s.number}>
            {LABELS.number[0]} {r.contract_number}
          </Text>
        </View>

        <View style={s.row}>
          <View style={[s.box, s.col]} wrap={false}>
            <L k="rental" ar={arabic} style={s.boxTitle} />
            <Line s={s} k="departure" ar={arabic} value={formatDateTime(r.start_at)} />
            <Line s={s} k="plannedReturn" ar={arabic} value={formatDateTime(r.end_at)} />
            {r.actual_return_at ? <Line s={s} k="actualReturn" ar={arabic} value={formatDateTime(r.actual_return_at)} /> : null}
            <Line s={s} k="delivery" ar={arabic} value={r.delivery ? r.delivery_place : LABELS.none[0]} />
            {r.delivery && r.return_place ? <Line s={s} k="returnPlace" ar={arabic} value={r.return_place} /> : null}
          </View>
          <View style={[s.box, s.col]} wrap={false}>
            <L k="vehicle" ar={arabic} style={s.boxTitle} />
            <Line s={s} k="model" ar={arabic} value={r.vehicle?.brand_model} />
            <Line s={s} k="plate" ar={arabic} value={r.vehicle?.plate} />
            <Line s={s} k="kmOut" ar={arabic} value={r.km_out === null ? null : `${r.km_out} km`} />
            {r.km_in !== null ? <Line s={s} k="kmIn" ar={arabic} value={`${r.km_in} km`} /> : null}
            <Line s={s} k="fuel" ar={arabic} value={`${fuel(r.fuel_out)}${r.fuel_in !== null ? ` » ${fuel(r.fuel_in)}` : ""}`} />
          </View>
        </View>

        <View style={s.row}>
          {r.driver1 ? <DriverBox s={s} d={r.driver1} title="driver1" ar={arabic} /> : null}
          {r.driver2 ? <DriverBox s={s} d={r.driver2} title="driver2" ar={arabic} /> : <View style={s.col} />}
        </View>

        <View style={s.row}>
          <View style={[s.box, s.col]} wrap={false}>
            <L k="price" ar={arabic} style={s.boxTitle} />
            <View style={s.priceLine}>
              <Text>
                {totals.days} × {formatMoney(r.daily_price)}
              </Text>
              <Text>{formatMoney(totals.days * Number(r.daily_price))}</Text>
            </View>
            {r.delivery ? (
              <View style={s.priceLine}>
                <L k="deliveryFee" ar={arabic} />
                <Text>{formatMoney(r.delivery_fee)}</Text>
              </View>
            ) : null}
            {Number(r.damage_fee) > 0 ? (
              <View style={s.priceLine}>
                <L k="damageFee" ar={arabic} />
                <Text>{formatMoney(r.damage_fee)}</Text>
              </View>
            ) : null}
            <View style={s.totalLine}>
              <L k="total" ar={arabic} />
              <Text>{formatMoney(totals.total)}</Text>
            </View>
            <View style={s.priceLine}>
              <L k="paid" ar={arabic} />
              <Text>{formatMoney(totals.paid)}</Text>
            </View>
            <View style={[s.priceLine, { fontWeight: 700 }]}>
              <L k="balance" ar={arabic} />
              <Text>{formatMoney(totals.balance)}</Text>
            </View>
            <View style={s.priceLine}>
              <L k="franchise" ar={arabic} />
              <Text>{formatMoney(r.franchise)}</Text>
            </View>
            <View style={s.priceLine}>
              <L k="deposit" ar={arabic} />
              <Text>{r.deposit_taken ? formatMoney(r.deposit_amount) : LABELS.none[0]}</Text>
            </View>
          </View>
          <View style={[s.box, s.col]} wrap={false}>
            <L k="equipment" ar={arabic} style={s.boxTitle} />
            <Text>{r.equipment.length ? r.equipment.join(", ") : "—"}</Text>
            <L k="documents" ar={arabic} style={[s.boxTitle, { marginTop: 6 }]} />
            <Text>{r.documents_given.length ? r.documents_given.join(", ") : "—"}</Text>
            {r.notes ? (
              <>
                <L k="notes" ar={arabic} style={[s.boxTitle, { marginTop: 6 }]} />
                <Text>{r.notes}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View wrap={false}>
          <L k="signatures" ar={arabic} style={s.boxTitle} />
          <View style={s.row}>
            <View style={s.signBox}>
              <L k="clientSignature" ar={arabic} style={s.small} />
            </View>
            <View style={s.signBox}>
              <L k="agencySignature" ar={arabic} style={s.small} />
              {r.signed_at ? (
                <Text style={[s.small, { marginTop: 4 }]}>
                  {LABELS.signedOn[0]} {formatDateTime(r.signed_at)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Footer s={s} ar={arabic} agency={agency.name} />
      </Page>

      <Page size="A4" style={s.page}>
        <L k="terms" ar={arabic} style={[s.title, { marginBottom: 10 }]} />
        <Text style={s.terms}>{agency.contract_terms?.trim() || LABELS.noTerms[0]}</Text>
        <Footer s={s} ar={arabic} agency={agency.name} />
      </Page>
    </Document>
  );
}

/** Downloads the agency logo for the PDF (PNG/JPG only; SVG/WEBP fall back to the initial). */
export async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url || !/\.(png|jpe?g)$/i.test(url)) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderContractPdf(data: ContractData, arabic: boolean): Promise<Buffer> {
  registerFonts();
  const logo = await fetchLogo(data.agency.logoUrl);
  return renderToBuffer(<ContractDocument data={data} arabic={arabic} logo={logo} />);
}
