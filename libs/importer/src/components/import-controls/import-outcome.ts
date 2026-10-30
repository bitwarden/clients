import { ImportResult, SdkImportSummary } from "../../models";

/** `cancelled`: feedback already shown, caller does nothing further. */
export type ImportOutcome =
  | { kind: "imported"; result: ImportResult }
  | { kind: "importedWithSdk"; sdkSummary: SdkImportSummary }
  | { kind: "cancelled" };
