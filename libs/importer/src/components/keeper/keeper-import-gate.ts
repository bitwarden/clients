import { ImportResult } from "../../models";
import { ImportRecordError } from "../../models/import-record-error";

/**
 * Decides whether the Keeper partial-import confirmation dialog is needed and whether any records
 * can be imported. Pure so it can be unit-tested without the Keeper component's Angular harness.
 */
export function keeperImportGate(
  result: ImportResult,
  errors: ImportRecordError[],
): { needsConfirmation: boolean; canImport: boolean } {
  return {
    needsConfirmation: errors.length > 0,
    canImport: result.ciphers.length > 0,
  };
}

/**
 * Decides whether to submit after the confirmation dialog closes. Only an explicit confirm
 * (`true`) submits, so `false` and `undefined` (escape/backdrop dismissal) both cancel, and the
 * zero-success case (`canImport` false) never submits.
 */
export function shouldSubmitAfterDialog(
  canImport: boolean,
  dialogResult: boolean | undefined,
): boolean {
  return canImport && dialogResult === true;
}
