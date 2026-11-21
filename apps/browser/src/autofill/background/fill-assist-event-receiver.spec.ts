import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { tagAsExternalMessage } from "../spec/testing-utils";

import { FillAssistEvent } from "./fill-assist-event";
import { NoopFillAssistEventReceiver, isFillAssistEvent } from "./fill-assist-event-receiver";

describe("NoopFillAssistEventReceiver", () => {
  let logService: MockProxy<LogService>;
  let receiver: NoopFillAssistEventReceiver;

  const event: FillAssistEvent = {
    name: "fill_assist_rule_qualification_failed",
    payload: {
      domain: "example.com",
      missReason: "structural",
      ruleId: "0",
    },
  };

  beforeEach(() => {
    logService = mock<LogService>();
    receiver = new NoopFillAssistEventReceiver(logService);
  });

  it("logs the event at debug level", () => {
    receiver.receive(event);

    expect(logService.debug).toHaveBeenCalledWith("[FillAssistEventReceiver:Noop]", event);
  });

  it("does not propagate when the log call throws", () => {
    logService.debug.mockImplementation(() => {
      throw new Error("log failure");
    });

    expect(() => receiver.receive(event)).not.toThrow();
  });
});

describe("isFillAssistEvent", () => {
  const validPayload = {
    domain: "example.com",
    missReason: "structural",
    ruleId: "0",
  };
  const buildMessage = (overrides: Record<string, unknown> = {}) => ({
    command: "fillAssistEmit",
    name: "fill_assist_rule_qualification_failed",
    payload: { ...validPayload },
    ...overrides,
  });

  it("accepts a tagged message with the full shape", () => {
    expect(isFillAssistEvent(tagAsExternalMessage(buildMessage()))).toBe(true);
  });

  it("rejects an untagged message with the full shape", () => {
    expect(isFillAssistEvent(buildMessage())).toBe(false);
  });

  it("rejects a tagged message with an unknown name", () => {
    expect(isFillAssistEvent(tagAsExternalMessage(buildMessage({ name: "other" })))).toBe(false);
  });

  it.each([null, undefined, 42, "not-an-object"])(
    "rejects a tagged message with a non-object payload (%p)",
    (payload) => {
      expect(isFillAssistEvent(tagAsExternalMessage(buildMessage({ payload })))).toBe(false);
    },
  );

  it.each(["domain", "ruleId"])("rejects when payload.%s is not a string", (key) => {
    const payload = { ...validPayload, [key]: 123 };
    expect(isFillAssistEvent(tagAsExternalMessage(buildMessage({ payload })))).toBe(false);
  });

  it("rejects a tagged message with an unknown missReason value", () => {
    const payload = { ...validPayload, missReason: "nonsense" };
    expect(isFillAssistEvent(tagAsExternalMessage(buildMessage({ payload })))).toBe(false);
  });
});
