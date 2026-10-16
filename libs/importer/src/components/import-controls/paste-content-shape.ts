import { ImportOption, UpgradeImportType } from "../../models";

export const PasteContentShape = Object.freeze({
  Json: "json",
  Xml: "xml",
  Csv: "csv",
} as const);
export type PasteContentShape = (typeof PasteContentShape)[keyof typeof PasteContentShape];

const PASTE_SHAPES: ReadonlySet<string> = new Set<string>(Object.values(PasteContentShape));

function isPasteContentShape(value: string): value is PasteContentShape {
  return PASTE_SHAPES.has(value);
}

// Vendors whose paste formats are distinguishable by shape. Excludes 1Password (wincsv/maccsv
// share a shape). Includes keepass now that keepassxcsv joined its picker card.
const SHAPE_NARROWABLE_VENDORS: ReadonlySet<UpgradeImportType> = new Set([
  "bitwarden",
  "dashlane",
  "keeper",
  "enpass",
  "avast",
  "delinea",
  "keepass",
]);

export function vendorSupportsPasteShapeNarrowing(vendorId: UpgradeImportType): boolean {
  return SHAPE_NARROWABLE_VENDORS.has(vendorId);
}

export function expectedPasteShapeFor(option: ImportOption): PasteContentShape | undefined {
  const [format, ...rest] = option.pasteFormats;
  return rest.length === 0 && isPasteContentShape(format) ? format : undefined;
}

/** First-character sniff: json starts with { or [, xml starts with <, anything else is csv. */
export function detectPasteContentShape(content: string): PasteContentShape {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return PasteContentShape.Json;
  }
  if (trimmed.startsWith("<")) {
    return PasteContentShape.Xml;
  }
  return PasteContentShape.Csv;
}
