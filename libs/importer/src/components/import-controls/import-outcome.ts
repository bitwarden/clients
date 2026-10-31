import { ImportResult, SdkImportSummary } from "../../models";

/**
 * `staged`: handed to location selection, which imports it.
 * `cancelled`: feedback already shown, caller does nothing further.
 */
export type ImportOutcome =
  | { kind: "imported"; result: ImportResult }
  | { kind: "importedWithSdk"; sdkSummary: SdkImportSummary }
  | { kind: "staged" }
  | { kind: "cancelled" };

/** An import that has actually run. */
export type FinishedImportOutcome = Extract<
  ImportOutcome,
  { kind: "imported" | "importedWithSdk" }
>;
