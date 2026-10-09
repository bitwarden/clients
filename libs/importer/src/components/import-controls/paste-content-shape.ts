import { ImportOption, ImportType } from "../../models";

export type PasteContentShape = "json" | "xml" | "csv";

const PASTE_SHAPES: ReadonlySet<string> = new Set<PasteContentShape>(["json", "xml", "csv"]);

// Vendors whose paste formats are distinguishable by shape. Excludes 1Password (wincsv/maccsv
// share a shape). Includes keepass now that keepassxcsv joined its picker card.
const SHAPE_NARROWABLE_VENDORS: ReadonlySet<ImportType> = new Set([
  "bitwarden",
  "dashlane",
  "keeper",
  "enpass",
  "avast",
  "delinea",
  "keepass",
]);

export function vendorSupportsPasteShapeNarrowing(vendorId: ImportType): boolean {
  return SHAPE_NARROWABLE_VENDORS.has(vendorId);
}

export function expectedPasteShapeFor(option: ImportOption): PasteContentShape | undefined {
  const [format, ...rest] = option.pasteFormats;
  return rest.length === 0 && PASTE_SHAPES.has(format) ? (format as PasteContentShape) : undefined;
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
