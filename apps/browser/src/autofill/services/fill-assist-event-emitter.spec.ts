import {
  FillAssistEvent,
  FillAssistEventName,
  FillAssistMissReason,
} from "../background/fill-assist-event-receiver";
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

  const sampleEvent: FillAssistEvent = {
    name: FillAssistEventName.QualificationFailed,
    payload: {
      domain: "example.com",
      missReason: FillAssistMissReason.Structural,
      ruleId: "0",
    },
  };

  beforeEach(() => {
    jest.mocked(autofillUtils.sendExtensionMessage).mockClear();
    jest.mocked(autofillUtils.sendExtensionMessage).mockResolvedValue(undefined);
    emitter = new DefaultFillAssistEventEmitter();
  });

  it("dispatches via sendExtensionMessage with the fillAssistEmit command and the full event", () => {
    emitter.emit(sampleEvent);

    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledTimes(1);
    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledWith("fillAssistEmit", sampleEvent);
  });

  it("returns synchronously without awaiting the dispatch", () => {
    // Emit returns `void` (not a Promise). Confirm the dispatch runs in the
    // background and the caller is not blocked.
    const result = emitter.emit(sampleEvent);
    expect(result).toBeUndefined();
  });

  it("swallows rejections from the dispatch so the caller never sees them", async () => {
    jest
      .mocked(autofillUtils.sendExtensionMessage)
      .mockRejectedValueOnce(new Error("relay unavailable"));

    expect(() => emitter.emit(sampleEvent)).not.toThrow();
    // Flush the rejection's microtask to confirm nothing propagates.
    await Promise.resolve();
  });

  it("dispatches each emit call independently", () => {
    const secondEvent: FillAssistEvent = {
      name: FillAssistEventName.QualificationFailed,
      payload: {
        domain: "example.org",
        missReason: FillAssistMissReason.InScopeExtras,
        ruleId: "0",
      },
    };

    emitter.emit(sampleEvent);
    emitter.emit(secondEvent);

    expect(autofillUtils.sendExtensionMessage).toHaveBeenCalledTimes(2);
    expect(autofillUtils.sendExtensionMessage).toHaveBeenNthCalledWith(
      1,
      "fillAssistEmit",
      sampleEvent,
    );
    expect(autofillUtils.sendExtensionMessage).toHaveBeenNthCalledWith(
      2,
      "fillAssistEmit",
      secondEvent,
    );
  });
});
