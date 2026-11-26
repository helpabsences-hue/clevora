import "server-only";
import type { Style } from "@react-pdf/stylesheet";
import { Circle, Document, G, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LABELS, type LabelKey } from "@/lib/contracts/labels";
import { FAMILY, fetchLogo, registerFonts } from "@/lib/contracts/pdf";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { Damage, DamageType, View as CarView } from "./model";
import { VIEWS } from "./model";
import type { InspectionReport, ReportSide } from "./report";

const VIEW_LABELS: Record<CarView, readonly [string, string]> = {
  front: ["Avant", "الأمام"],
  back: ["Arrière", "الخلف"],
  left: ["Côté gauche", "الجانب الأيسر"],
  right: ["Côté droit", "الجانب الأيمن"],
  wheels: ["Roues", "العجلات"],
  roof: ["Toit", "السقف"],
  interior: ["Intérieur", "الداخل"],
  trunk: ["Coffre", "الصندوق"],
};
const TYPE_LABELS: Record<DamageType, readonly [string, string]> = {
  scratch: ["Rayure", "خدش"],
  dent: ["Bosse / choc", "ضربة"],
  glass: ["Vitre / feu", "زجاج / ضوء"],
  tyre: ["Pneu / jante", "عجلة / جنط"],
  interior: ["Intérieur", "الداخل"],
  missing: ["Pièce manquante", "قطعة ناقصة"],
  other: ["Autre", "أخرى"],
};
const RED = "#DC2626";
const GREY = "#64748B";

function styles(brand: string) {
  return StyleSheet.create({
    page: { fontFamily: FAMILY, fontSize: 8.5, color: "#0F172A", paddingTop: 26, paddingBottom: 38, paddingHorizontal: 28 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 2, borderBottomColor: brand, paddingBottom: 8 },
    logo: { width: 40, height: 40, objectFit: "contain" },
    logoBox: { width: 40, height: 40, borderRadius: 6, backgroundColor: brand, color: "#FFFFFF", fontSize: 18, fontWeight: 700, textAlign: "center", paddingTop: 8 },
    agencyName: { fontSize: 13, fontWeight: 700 },
    muted: { color: "#475569" },
    small: { fontSize: 7.5, color: "#475569" },
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 8 },
    title: { fontSize: 13, fontWeight: 700, color: brand },
    number: { fontSize: 11, fontWeight: 700, borderWidth: 1.5, borderColor: brand, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
    row: { flexDirection: "row", gap: 8 },
    col: { flex: 1 },
    box: { borderWidth: 0.75, borderColor: "#CBD5E1", borderRadius: 4, padding: 6, marginBottom: 7 },
    boxTitle: { fontSize: 9.5, fontWeight: 700, color: brand, marginBottom: 4 },
    line: { flexDirection: "row", marginBottom: 2.5, gap: 4 },
    label: { width: "38%", color: "#475569" },
    value: { width: "62%", fontWeight: 700 },
    sideRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
    damage: { flexDirection: "row", gap: 4, marginBottom: 3, alignItems: "flex-start" },
    bullet: { width: 13, height: 13, borderRadius: 7, color: "#FFFFFF", fontSize: 7, fontWeight: 700, textAlign: "center", paddingTop: 2 },
    result: { borderRadius: 4, padding: 7, marginBottom: 7, fontWeight: 700, fontSize: 10 },
    signBox: { flex: 1, height: 64, borderWidth: 0.75, borderColor: "#94A3B8", borderRadius: 4, padding: 6 },
    photoRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
    photoCell: { flex: 1 },
    photo: { width: "100%", height: 118, objectFit: "cover", borderRadius: 3 },
    photoEmpty: { height: 118, borderWidth: 0.75, borderColor: "#CBD5E1", borderStyle: "dashed", borderRadius: 3, color: "#94A3B8", textAlign: "center", paddingTop: 52 },
    footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94A3B8" },
  });
}
type Styles = ReturnType<typeof styles>;

/** French label, Arabic next to it when asked (same rule as the contract). */
function L({ pair, ar, style }: { pair: readonly [string, string]; ar: boolean; style?: Style | Style[] }) {
  return (
    <Text style={style}>
      {pair[0]}
      {ar ? <Text style={{ fontFamily: "NotoSansArabic" }}>{`  ${pair[1]}`}</Text> : null}
    </Text>
  );
}
const lab = (k: LabelKey) => LABELS[k];

function Line_({ s, k, ar, value }: { s: Styles; k: LabelKey; ar: boolean; value: string | null | undefined }) {
  return (
    <View style={s.line} wrap={false}>
      <L pair={lab(k)} ar={ar} style={s.label} />
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

/** The same top view of a car as in the app (front at the top), with numbered marks. */
function Diagram({ marks }: { marks: Array<{ x: number; y: number; n: number; color: string }> }) {
  return (
    <Svg viewBox="0 0 200 400" style={{ width: 92, height: 184 }}>
      {[
        [22, 82],
        [158, 82],
        [22, 262],
        [158, 262],
      ].map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x} y={y} width={20} height={56} rx={7} fill="#475569" />
      ))}
      <Path d="M100 18 C150 18 168 40 170 78 L172 318 C172 360 152 384 100 384 C48 384 28 360 28 318 L30 78 C32 40 50 18 100 18 Z" fill="#FFFFFF" stroke="#64748B" strokeWidth={3} />
      <Path d="M52 112 C80 96 120 96 148 112 L140 150 C112 142 88 142 60 150 Z" fill="#DDD6FE" stroke="#94A3B8" strokeWidth={2} />
      <Rect x={60} y={160} width={80} height={96} rx={10} fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={2} />
      <Path d="M60 268 C88 276 112 276 140 268 L148 300 C120 312 80 312 52 300 Z" fill="#DDD6FE" stroke="#94A3B8" strokeWidth={2} />
      <Rect x={14} y={128} width={16} height={10} rx={4} fill="#64748B" />
      <Rect x={170} y={128} width={16} height={10} rx={4} fill="#64748B" />
      {[180, 236].map((y) => (
        <G key={y}>
          <Line x1={32} y1={y} x2={52} y2={y} stroke="#CBD5E1" strokeWidth={2} />
          <Line x1={148} y1={y} x2={168} y2={y} stroke="#CBD5E1" strokeWidth={2} />
        </G>
      ))}
      {marks.map((m) => (
        <G key={m.n}>
          <Circle cx={m.x * 200} cy={m.y * 400} r={13} fill={m.color} stroke="#FFFFFF" strokeWidth={3} />
          <Text x={m.x * 200} y={m.y * 400 + 5} textAnchor="middle" fill="#FFFFFF" style={{ fontSize: 14, fontWeight: 700 }}>
            {String(m.n)}
          </Text>
        </G>
      ))}
    </Svg>
  );
}

function Side({ s, ar, title, side, fresh, brand }: { s: Styles; ar: boolean; title: LabelKey; side: ReportSide | null; fresh: Set<string>; brand: string }) {
  const color = (d: Damage) => (fresh.has(d.id) ? RED : title === "returnInspection" ? GREY : brand);
  return (
    <View style={[s.box, s.col]} wrap={false}>
      <L pair={lab(title)} ar={ar} style={s.boxTitle} />
      {side?.completedAt ? (
        <Text style={[s.small, { marginBottom: 4 }]}>
          {lab("doneOn")[0]} {formatDateTime(side.completedAt)}
        </Text>
      ) : (
        <L pair={lab("notDone")} ar={ar} style={[s.small, { marginBottom: 4 }]} />
      )}
      <View style={s.sideRow}>
        <Diagram marks={(side?.damages ?? []).map((d, i) => ({ x: d.x, y: d.y, n: i + 1, color: color(d) }))} />
        <View style={s.col}>
          {side?.damages.length ? (
            side.damages.map((d, i) => (
              <View key={d.id} style={s.damage} wrap={false}>
                <Text style={[s.bullet, { backgroundColor: color(d) }]}>{i + 1}</Text>
                <View style={s.col}>
                  <Text style={{ fontWeight: 700 }}>
                    {TYPE_LABELS[d.type][0]}
                    {ar ? <Text style={{ fontFamily: "NotoSansArabic", fontWeight: 400 }}>{`  ${TYPE_LABELS[d.type][1]}`}</Text> : null}
                    {d.view ? <Text style={{ fontWeight: 400, color: "#475569" }}>{` · ${VIEW_LABELS[d.view][0]}`}</Text> : null}
                  </Text>
                  {d.note ? <Text style={s.small}>{d.note}</Text> : null}
                  {title === "returnInspection" ? (
                    <Text style={[s.small, { color: fresh.has(d.id) ? RED : GREY }]}>{fresh.has(d.id) ? lab("isNew")[0] : lab("existing")[0]}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : side ? (
            <L pair={lab("noDamage")} ar={ar} style={s.muted} />
          ) : null}
          {side?.notes ? (
            <Text style={[s.small, { marginTop: 4 }]}>
              {lab("notes")[0]} : {side.notes}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Footer({ s, ar, agency }: { s: Styles; ar: boolean; agency: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{agency}</Text>
      <L pair={lab("poweredBy")} ar={ar} />
      <Text render={({ pageNumber, totalPages }) => `${lab("page")[0]} ${pageNumber}/${totalPages}`} />
    </View>
  );
}

export function InspectionReportDocument({ report, arabic, logo }: { report: InspectionReport; arabic: boolean; logo: Buffer | null }) {
  const { reservation: r, agency } = report.contract;
  const s = styles(agency.brand);
  const fresh = new Set(report.fresh.map((d) => d.id));
  const both = report.departure?.completedAt && report.return?.completedAt;
  const fuel = (q: number | null) => (q === null ? "—" : `${q}/4`);
  const video = report.departure?.mode === "video" || report.return?.mode === "video";
  const views = VIEWS.filter((v) => report.departure?.photos[v] || report.return?.photos[v]);

  return (
    <Document title={`${lab("reportTitle")[0]} ${r.contract_number}`} author={agency.name} creator="Parcolia" producer="Parcolia">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.logoBox}>{agency.name.trim().charAt(0).toUpperCase()}</Text>}
          <View style={s.col}>
            <Text style={s.agencyName}>{agency.name}</Text>
            <Text style={s.muted}>{[agency.address, agency.city].filter(Boolean).join(", ")}</Text>
            <Text style={s.muted}>{[formatPhone(agency.phone), agency.email].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>

        <View style={s.titleRow}>
          <L pair={lab("reportTitle")} ar={arabic} style={s.title} />
          <Text style={s.number}>
            {lab("contract")[0]} {r.contract_number}
          </Text>
        </View>

        <View style={s.row}>
          <View style={[s.box, s.col]} wrap={false}>
            <L pair={lab("vehicle")} ar={arabic} style={s.boxTitle} />
            <Line_ s={s} k="model" ar={arabic} value={r.vehicle?.brand_model} />
            <Line_ s={s} k="plate" ar={arabic} value={r.vehicle?.plate} />
            <Line_ s={s} k="kmOut" ar={arabic} value={r.km_out === null ? null : `${r.km_out} km${r.km_in !== null ? ` » ${r.km_in} km` : ""}`} />
            <Line_ s={s} k="fuel" ar={arabic} value={`${fuel(r.fuel_out)}${r.fuel_in !== null ? ` » ${fuel(r.fuel_in)}` : ""}`} />
          </View>
          <View style={[s.box, s.col]} wrap={false}>
            <L pair={lab("client")} ar={arabic} style={s.boxTitle} />
            <Line_ s={s} k="name" ar={arabic} value={r.driver1?.full_name} />
            <Line_ s={s} k={r.driver1?.id_type === "passport" ? "passport" : "cin"} ar={arabic} value={r.driver1?.id_number} />
            <Line_ s={s} k="departure" ar={arabic} value={formatDateTime(r.start_at)} />
            <Line_ s={s} k={r.actual_return_at ? "actualReturn" : "plannedReturn"} ar={arabic} value={formatDateTime(r.actual_return_at ?? r.end_at)} />
          </View>
        </View>

        <View style={s.row}>
          <Side s={s} ar={arabic} title="departureInspection" side={report.departure} fresh={fresh} brand={agency.brand} />
          <Side s={s} ar={arabic} title="returnInspection" side={report.return} fresh={fresh} brand={agency.brand} />
        </View>

        {both ? (
          <View style={[s.result, { backgroundColor: report.fresh.length ? "#FEE2E2" : "#DCFCE7", color: report.fresh.length ? "#991B1B" : "#166534" }]} wrap={false}>
            {report.fresh.length ? (
              <Text>
                {lab("newDamages")[0]} : {report.fresh.length} — {report.fresh.map((d) => TYPE_LABELS[d.type][0] + (d.view ? ` (${VIEW_LABELS[d.view][0]})` : "")).join(", ")}
              </Text>
            ) : (
              <L pair={lab("noNewDamage")} ar={arabic} />
            )}
          </View>
        ) : null}
        {Number(r.damage_fee) > 0 ? (
          <View style={[s.box, { flexDirection: "row", justifyContent: "space-between" }]} wrap={false}>
            <View style={s.col}>
              <L pair={lab("damageFee")} ar={arabic} style={{ fontWeight: 700 }} />
              {r.damage_note ? <Text style={s.small}>{r.damage_note}</Text> : null}
            </View>
            <Text style={{ fontWeight: 700, fontSize: 10 }}>{formatMoney(r.damage_fee)}</Text>
          </View>
        ) : null}
        {video ? <L pair={lab("video")} ar={arabic} style={[s.small, { marginBottom: 6 }]} /> : null}

        <View wrap={false}>
          <L pair={lab("clientAgrees")} ar={arabic} style={[s.small, { marginBottom: 4 }]} />
          <View style={s.row}>
            <View style={s.signBox}>
              <L pair={lab("clientSignature")} ar={arabic} style={s.small} />
            </View>
            <View style={s.signBox}>
              <L pair={lab("agencySignature")} ar={arabic} style={s.small} />
            </View>
          </View>
        </View>
        <Footer s={s} ar={arabic} agency={agency.name} />
      </Page>

      {views.length ? (
        <Page size="A4" style={s.page}>
          <L pair={lab("photos")} ar={arabic} style={[s.title, { marginBottom: 8 }]} />
          {views.map((v) => (
            <View key={v} wrap={false}>
              <L pair={VIEW_LABELS[v]} ar={arabic} style={[s.boxTitle, { marginBottom: 3 }]} />
              <View style={s.photoRow}>
                {[report.departure?.photos[v], report.return?.photos[v]].map((img, i) => (
                  <View key={i} style={s.photoCell}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
                    {img ? <Image src={img} style={s.photo} /> : <Text style={s.photoEmpty}>{lab("noPhoto")[0]}</Text>}
                    <Text style={s.small}>{i === 0 ? lab("departure")[0] : lab("returnInspection")[0]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Footer s={s} ar={arabic} agency={agency.name} />
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderInspectionPdf(report: InspectionReport, arabic: boolean): Promise<Buffer> {
  registerFonts();
  const logo = await fetchLogo(report.contract.agency.logoUrl);
  return renderToBuffer(<InspectionReportDocument report={report} arabic={arabic} logo={logo} />);
}
