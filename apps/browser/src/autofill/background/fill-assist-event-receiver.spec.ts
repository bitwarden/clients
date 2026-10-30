import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { FillAssistEvent, NoopFillAssistEventReceiver } from "./fill-assist-event-receiver";

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
