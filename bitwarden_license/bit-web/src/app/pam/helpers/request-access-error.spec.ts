import {
  REQUEST_ACCESS_SDK_ERRORS,
  REQUEST_ACCESS_SERVER_ERRORS,
  classifyRequestAccessError,
} from "./request-access-error";

// Spelled out with a real cap rather than read off a constant: none is pinned on this side.
const WINDOW_EXCEEDS_7D = "The requested window exceeds the maximum of 604800 seconds.";

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
      REQUEST_ACCESS_SERVER_ERRORS.AutomaticGotWindow,
      REQUEST_ACCESS_SERVER_ERRORS.HumanGotDuration,
      REQUEST_ACCESS_SERVER_ERRORS.StartEndRequired,
      REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd,
      REQUEST_ACCESS_SERVER_ERRORS.WindowInPast,
      REQUEST_ACCESS_SDK_ERRORS.WindowInPast,
      REQUEST_ACCESS_SERVER_ERRORS.NotLeasingGated,
      REQUEST_ACCESS_SERVER_ERRORS.Unlicensed,
    ])("echoes %s inline with no pinned field", (message) => {
      expect(classifyRequestAccessError(message)).toEqual({
        kind: "inline",
        serverMessage: message,
      });
    });

    // Spelled out, not read off the catalog: comparing each constant against itself would pass
    // however it's worded. These literals are the copies of record —
    // `SubmitAccessRequestCommand.RequestHumanApprovalAsync` and
    // `AccessRequestWindowError::EndInPast` — so editing either without the other fails.
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

  // The server words these from the governing rule's own cap, so a fixed sentence matches exactly
  // one configuration and misses every other. Only the number is reported: the caller renders it
  // in the requester's own language.
  describe("interpolated maximum cases", () => {
    // The scope is reported too: wording a duration refusal as a window one would be plainly wrong.
    it.each([
      [
        "the duration path",
        "The requested duration exceeds the maximum of 1800 seconds.",
        "duration",
        1800,
      ],
      ["the window path", WINDOW_EXCEEDS_7D, "window", 604800],
    ])("reports the server's own maximum on %s", (_label, message, scope, maxSeconds) => {
      expect(classifyRequestAccessError(message)).toEqual({
        kind: "exceedsMax",
        scope,
        maxSeconds,
        serverMessage: message,
      });
    });

    it("recognises it through a wrapper prefix the wasm boundary may add", () => {
      expect(classifyRequestAccessError(`Api error: ${WINDOW_EXCEEDS_7D}`)).toEqual({
        kind: "exceedsMax",
        scope: "window",
        maxSeconds: 604800,
        serverMessage: WINDOW_EXCEEDS_7D,
      });
    });

    it("falls back to generic when the sentence names no maximum", () => {
      // The number is the actionable part; matching the prose alone would echo a useless sentence.
      expect(
        classifyRequestAccessError("The requested window exceeds the maximum of seconds."),
      ).toEqual({ kind: "generic" });
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
    // Reconciliation is checked first, since it's more useful than pointing at a field the
    // requester can't fix.
    const message = `${WINDOW_EXCEEDS_7D} ${REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive}`;

    expect(classifyRequestAccessError(message)).toEqual({
      kind: "reconcile",
      toastKey: "requestAccessModalAlreadyActive",
    });
  });
});
