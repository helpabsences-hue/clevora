import { describe, expect, it } from "vitest";
import { checkDigit, nationalityName, parseMrz } from "./mrz";

const NOW = new Date("2026-11-20T12:00:00Z");

describe("MRZ", () => {
  it("check digits (ICAO 9303 examples)", () => {
    expect(checkDigit("L898902C3")).toBe(6);
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
  });

  it("passport (TD3) specimen", () => {
    const r = parseMrz("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10", NOW)!;
    expect(r).toMatchObject({
      format: "TD3",
      idType: "passport",
      idNumber: "L898902C3",
      surname: "ERIKSSON",
      givenNames: "ANNA MARIA",
      fullName: "ERIKSSON Anna Maria",
      nationality: "UTO",
      birthDate: "1974-08-12",
      expiryDate: "2012-04-15",
      sex: "F",
      valid: true,
    });
  });

  it("ID card (TD1) specimen, with OCR noise around and inside", () => {
    const text = ["ROYAUME DU MAROC", "I<UTOD231458907<<<<<<<<<<<<<<<", "74O8122F12O4159UTO<<<<<<<<<<<6", "ERIKSSON<<ANNA<MARIA<<<<<<<<<<", "signature"].join("\n");
    const r = parseMrz(text, NOW)!;
    expect(r).toMatchObject({ format: "TD1", idType: "cin", documentNumber: "D23145890", birthDate: "1974-08-12", expiryDate: "2012-04-15", valid: true });
  });

  it("Moroccan CIN: the national number comes from the optional data", () => {
    const l1base = "IDMARZ12345678";
    const l1 = `${l1base}${checkDigit(l1base.slice(5, 14))}AB123456<<<<<<<`.slice(0, 30);
    const birth = "900315";
    const exp = "310101";
    const l2 = `${birth}${checkDigit(birth)}M${exp}${checkDigit(exp)}MAR<<<<<<<<<<<0`;
    const r = parseMrz(`${l1}\n${l2}\nBENNANI<<YASSINE<<<<<<<<<<<<<<`, NOW)!;
    expect(r).toMatchObject({ idType: "cin", idNumber: "AB123456", fullName: "BENNANI Yassine", nationality: "MAR", birthDate: "1990-03-15", expiryDate: "2031-01-01", sex: "M", valid: true });
    expect(nationalityName(r.nationality)).toBe("Marocaine");
  });

  it("filler read as K/L at the end of the name line is ignored", () => {
    const l1 = "IDMARZ123456789AB123456<<<<<<<";
    const r = parseMrz(`${l1}\n9003152M3101012MAR<<<<<<<<<<<0\nBENNANI<<YASSINE<<<<<<<LLKLLKL<<`, NOW)!;
    expect(r.givenNames).toBe("YASSINE");
    expect(r.valid).toBe(true);
  });

  it("no MRZ in the text: null", () => {
    expect(parseMrz("ROYAUME DU MAROC\nCARTE NATIONALE", NOW)).toBeNull();
  });
});
