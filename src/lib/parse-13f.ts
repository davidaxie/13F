import { XMLParser } from "fast-xml-parser";

export type Holding = {
  issuer: string;
  titleOfClass: string;
  cusip: string;
  value: number;
  shares: number;
  sharesType: string;
  putCall?: string;
  investmentDiscretion?: string;
};

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: true,
  trimValues: true,
  numberParseOptions: { hex: false, leadingZeros: false, eNotation: false },
});

type RawHolding = {
  nameOfIssuer?: string;
  titleOfClass?: string;
  cusip?: string;
  value?: string | number;
  shrsOrPrnAmt?: {
    sshPrnamt?: string | number;
    sshPrnamtType?: string;
  };
  putCall?: string;
  investmentDiscretion?: string;
};

export function parseInfoTable(xml: string): Holding[] {
  const data = parser.parse(xml) as {
    informationTable?: { infoTable?: RawHolding | RawHolding[] };
  };
  const table = data.informationTable;
  if (!table) return [];
  let rows = table.infoTable ?? [];
  if (!Array.isArray(rows)) rows = [rows];

  return rows.map((r) => ({
    issuer: String(r.nameOfIssuer ?? "").trim(),
    titleOfClass: String(r.titleOfClass ?? "").trim(),
    cusip: String(r.cusip ?? "").trim(),
    value: Number(r.value ?? 0),
    shares: Number(r.shrsOrPrnAmt?.sshPrnamt ?? 0),
    sharesType: String(r.shrsOrPrnAmt?.sshPrnamtType ?? "").trim(),
    putCall: r.putCall ? String(r.putCall).trim() : undefined,
    investmentDiscretion: r.investmentDiscretion
      ? String(r.investmentDiscretion).trim()
      : undefined,
  }));
}
