import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ImportRecordError,
  ImportRecordErrorReason,
} from "../../importers/keeper/keeper-import-error";
import { ImportResult } from "../../models";

import { keeperImportGate, shouldSubmitAfterDialog } from "./keeper-import-gate";

describe("keeperImportGate", () => {
  function resultWith(cipherCount: number): ImportResult {
    const result = new ImportResult();
    result.ciphers = Array.from({ length: cipherCount }, () => new CipherView());
    return result;
  }

  function errorsWith(errorCount: number): ImportRecordError[] {
    return Array.from(
      { length: errorCount },
      () => new ImportRecordError("x", ImportRecordErrorReason.Error),
    );
  }

  it("does not need confirmation when there are no errors", () => {
    expect(keeperImportGate(resultWith(3), errorsWith(0))).toEqual({
      needsConfirmation: false,
      canImport: true,
    });
  });

  it("needs confirmation when there are errors and records can still be imported", () => {
    expect(keeperImportGate(resultWith(2), errorsWith(1))).toEqual({
      needsConfirmation: true,
      canImport: true,
    });
  });

  it("cannot import when there are no ciphers", () => {
    expect(keeperImportGate(resultWith(0), errorsWith(2))).toEqual({
      needsConfirmation: true,
      canImport: false,
    });
  });
});

describe("shouldSubmitAfterDialog", () => {
  it("submits only on explicit confirm", () => {
    expect(shouldSubmitAfterDialog(true, true)).toBe(true);
  });

  it("does not submit on cancel (false)", () => {
    expect(shouldSubmitAfterDialog(true, false)).toBe(false);
  });

  it("does not submit on dismissal (undefined)", () => {
    expect(shouldSubmitAfterDialog(true, undefined)).toBe(false);
  });

  it("never submits in the zero-success case regardless of the dialog result", () => {
    expect(shouldSubmitAfterDialog(false, true)).toBe(false);
    expect(shouldSubmitAfterDialog(false, false)).toBe(false);
  });
});
