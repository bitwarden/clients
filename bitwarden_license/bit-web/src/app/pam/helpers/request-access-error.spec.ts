import { classifyRequestAccessError } from "./request-access-error";

describe("classifyRequestAccessError", () => {
  describe("reconciliation cases", () => {
    it.each([
      ["AlreadyActive", "requestAccessModalAlreadyActive"],
      ["AlreadyApproved", "requestAccessModalAlreadyApproved"],
      ["AlreadyPending", "requestAccessModalAlreadyPending"],
    ])("maps %s to its information toast", (variant, toastKey) => {
      // Not failures: the requester asked for something they already have, so the banner reconciles
      // instead of reporting an error. This used to hinge on the server's exact wording.
      expect(classifyRequestAccessError(variant)).toEqual({ kind: "reconcile", toastKey });
    });
  });

  describe("correctable cases", () => {
    it("pins a missing reason to the reason control", () => {
      expect(classifyRequestAccessError("ReasonRequired")).toEqual({
        kind: "inline",
        messageKey: "pamRequestAccessErrorReasonRequired",
        field: "reason",
      });
    });

    it.each([
      ["DurationMustBePositive", "pamRequestAccessErrorDurationRequired"],
      ["DurationExceedsMax", "pamRequestAccessErrorDurationExceedsMax"],
      ["DurationExpected", "pamRequestAccessErrorDurationExpected"],
      ["WindowExpected", "pamRequestAccessErrorWindowExpected"],
      ["WindowRequired", "pamRequestAccessErrorWindowRequired"],
      ["WindowEndBeforeStart", "pamRequestAccessErrorWindowEndBeforeStart"],
      ["WindowExceedsMax", "pamRequestAccessErrorWindowExceedsMax"],
      ["CipherNotGated", "pamRequestAccessErrorNotGated"],
      ["DeniedByNetwork", "pamRequestAccessErrorDeniedByNetwork"],
      ["DeniedBySchedule", "pamRequestAccessErrorDeniedBySchedule"],
      ["Denied", "pamRequestAccessErrorDenied"],
    ])("shows %s inline with no pinned field", (variant, messageKey) => {
      expect(classifyRequestAccessError(variant)).toEqual({
        kind: "inline",
        messageKey,
        field: undefined,
      });
    });
  });

  describe("fallback", () => {
    it.each([
      ["the transport variant", "Api"],
      ["a variant this client version does not know", "InventedNextYear"],
      ["an empty variant", ""],
      ["a null variant", null],
      ["an undefined variant", undefined],
    ])("falls back to generic for %s", (_label, variant) => {
      // An unknown code is safe to treat as a plain failure by contract, which is what lets the
      // server add codes without waiting on a client release.
      expect(classifyRequestAccessError(variant)).toEqual({ kind: "generic" });
    });
  });
});
