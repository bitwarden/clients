import { ImportType } from "../../models";

export type PasteContentShape = "json" | "xml" | "csv";

// Vendors whose paste formats are distinguishable by shape. Explicit list — excludes 1Password.
const SHAPE_NARROWABLE_VENDORS: ReadonlySet<ImportType> = new Set([
  "bitwardenjson",
  "dashlanecsv",
  "keeper",
  "enpasscsv",
  "avastcsv",
  "delineaxml",
]);

const SHAPE_BY_FORMAT: Partial<Record<ImportType, PasteContentShape>> = {
  bitwardenjson: "json",
  bitwardencsv: "csv",
  dashlanejson: "json",
  dashlanecsv: "csv",
  keeperjson: "json",
  keepercsv: "csv",
  enpassjson: "json",
  enpasscsv: "csv",
  avastjson: "json",
  avastcsv: "csv",
  delineaxml: "xml",
  delineacsv: "csv",
};

export function vendorSupportsPasteShapeNarrowing(vendorId: ImportType): boolean {
  return SHAPE_NARROWABLE_VENDORS.has(vendorId);
}

export function expectedPasteShapeFor(format: ImportType): PasteContentShape | undefined {
  return SHAPE_BY_FORMAT[format];
}

/** First-character sniff: json starts with { or [, xml starts with <, anything else is csv. */
export function detectPasteContentShape(content: string): PasteContentShape {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  if (trimmed.startsWith("<")) {
    return "xml";
  }
  return "csv";
}
