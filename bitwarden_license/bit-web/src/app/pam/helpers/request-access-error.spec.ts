import {
  REQUEST_ACCESS_SDK_ERRORS,
  REQUEST_ACCESS_SERVER_ERRORS,
  classifyRequestAccessError,
} from "./request-access-error";

describe("classifyRequestAccessError", () => {
  describe("reconciliation cases", () => {
    it.each([
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive, "requestAccessModalAlreadyActive"],
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyApproved, "requestAccessModalAlreadyApproved"],
      [REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending, "requestAccessModalAlreadyPending"],
    ])("maps %s to its information toast", (message, toastKey) => {
      expect(classifyRequestAccessError(message)).toEqual({ kind: "reconcile", toastKey });
    });

    it("recognises the case through a wrapper prefix the wasm boundary may add", () => {
      const wrapped = `Api error: ${REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending}`;

      expect(classifyRequestAccessError(wrapped)).toEqual({
        kind: "reconcile",
        toastKey: "requestAccessModalAlreadyPending",
      });
    });
  });

  describe("inline validation cases", () => {
    it("pins a missing reason to the reason control", () => {
      expect(classifyRequestAccessError(REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired)).toEqual({
        kind: "inline",
        serverMessage: REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired,
        field: "reason",
      });
    });

    it.each([
      REQUEST_ACCESS_SERVER_ERRORS.PositiveDurationRequired,
      REQUEST_ACCESS_SERVER_ERRORS.DurationExceedsMax,
      REQUEST_ACCESS_SERVER_ERRORS.AutomaticGotWindow,
      REQUEST_ACCESS_SERVER_ERRORS.HumanGotDuration,
      REQUEST_ACCESS_SERVER_ERRORS.StartEndRequired,
      REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd,
      REQUEST_ACCESS_SERVER_ERRORS.WindowInPast,
      REQUEST_ACCESS_SDK_ERRORS.WindowInPast,
      REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax,
      REQUEST_ACCESS_SERVER_ERRORS.NotLeasingGated,
      REQUEST_ACCESS_SERVER_ERRORS.Unlicensed,
    ])("echoes %s inline with no pinned field", (message) => {
      expect(classifyRequestAccessError(message)).toEqual({
        kind: "inline",
        serverMessage: message,
      });
    });

    // Spelled out rather than read off the catalog: the cases above compare each constant against
    // itself, so they pass however the constant is worded. An elapsed window is refused on both
    // sides, in two different sentences, and recognising only one of them is what left the
    // requester with the generic toast instead of the inline message (PM-42592). These literals
    // are the copies of record -- `SubmitAccessRequestCommand.RequestHumanApprovalAsync` and
    // `AccessRequestWindowError::EndInPast` -- so editing either without editing its source here
    // fails.
    it.each([
      ["the server refuses it on arrival", "The end date must be in the future."],
      ["the SDK refuses it before the wire", "The requested window has already ended."],
    ])("echoes the elapsed-window refusal inline when %s", (_label, message) => {
      expect(classifyRequestAccessError(message)).toEqual({
        kind: "inline",
        serverMessage: message,
      });
    });
  });

  describe("fallback", () => {
    it.each([
      ["an unrecognised message", "Something else went wrong"],
      ["an empty message", ""],
      ["a null message", null],
      ["an undefined message", undefined],
    ])("falls back to generic for %s", (_label, message) => {
      expect(classifyRequestAccessError(message)).toEqual({ kind: "generic" });
    });
  });

  it("prefers reconciliation over inline when a message somehow carries both", () => {
    // Reconciliation is checked first on purpose: telling the requester "you already have this"
    // is more useful than pointing at a field they cannot fix.
    const message = `${REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax} ${REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive}`;

    expect(classifyRequestAccessError(message)).toEqual({
      kind: "reconcile",
      toastKey: "requestAccessModalAlreadyActive",
    });
  });
});
