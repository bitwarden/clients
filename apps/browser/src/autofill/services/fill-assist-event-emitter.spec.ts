import { FillAssistEventName, FillAssistMissReason } from "../background/fill-assist-event";
import * as autofillUtils from "../utils";

import { DefaultFillAssistEventEmitter } from "./fill-assist-event-emitter";

jest.mock("../utils", () => {
  const utils = jest.requireActual("../utils");
  return {
    ...utils,
    sendExtensionMessage: jest.fn().mockResolvedValue(undefined),
  };
});

describe("DefaultFillAssistEventEmitter", () => {
  let emitter: DefaultFillAssistEventEmitter;

  beforeEach(() => {
    jest.mocked(autofillUtils.sendExtensionMessage).mockClear();
    jest.mocked(autofillUtils.sendExtensionMessage).mockResolvedValue(undefined);
    emitter = new DefaultFillAssistEventEmitter();
  });

  it("dispatches qualificationFailed as a fillAssistEmit message with the structural event shape", () => {
    emitter.qualificationFailed("example.com", FillAssistMissReason.Structural);

    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledTimes(1);
    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledWith("fillAssistEmit", {
      name: FillAssistEventName.QualificationFailed,
      payload: {
        domain: "example.com",
        missReason: FillAssistMissReason.Structural,
        ruleId: "0",
      },
    });
  });

  it("carries the given missReason through on an in-scope-extras miss", () => {
    emitter.qualificationFailed("example.org", FillAssistMissReason.InScopeExtras);

    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledWith("fillAssistEmit", {
      name: FillAssistEventName.QualificationFailed,
      payload: {
        domain: "example.org",
        missReason: FillAssistMissReason.InScopeExtras,
        ruleId: "0",
      },
    });
  });

  it("returns synchronously without awaiting the dispatch", () => {
    // qualificationFailed returns `void` (not a Promise). Confirm the dispatch
    // runs in the background and the caller is not blocked.
    const result = emitter.qualificationFailed("example.com", FillAssistMissReason.Structural);
    expect(result).toBeUndefined();
  });

  it("swallows rejections from the dispatch so the caller never sees them", async () => {
    jest
      .mocked(autofillUtils.sendExtensionMessage)
      .mockRejectedValueOnce(new Error("relay unavailable"));

    expect(() =>
      emitter.qualificationFailed("example.com", FillAssistMissReason.Structural),
    ).not.toThrow();
    // Flush the rejection's microtask to confirm nothing propagates.
    await Promise.resolve();
  });

  it("dispatches each call independently", () => {
    emitter.qualificationFailed("example.com", FillAssistMissReason.Structural);
    emitter.qualificationFailed("example.org", FillAssistMissReason.InScopeExtras);

    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledTimes(2);
  });
});
