import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { createChromeTabMock } from "../spec/autofill-mocks";

import { AutofillLifecycleService } from "./abstractions/autofill-lifecycle.service";
import { NoopAutofillLifecycleService } from "./noop-autofill-lifecycle.service";

describe("NoopAutofillLifecycleService", () => {
  const logService = mock<LogService>();
  // Typed as the abstraction — the popup consumes it through that token, and
  // the abstraction's signatures carry the (tab, frameId) arguments the no-op
  // ignores.
  let service: AutofillLifecycleService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new NoopAutofillLifecycleService(logService);
  });

  // The lifecycle runs only in the background; reaching any member from the
  // foreground is a bug. Each call must announce itself rather than silently
  // doing nothing, and must name the member so the offending path is findable.
  it.each([
    ["init", () => service.init()],
    ["reportPageTransition", () => service.reportPageTransition(createChromeTabMock(), 0)],
    ["startMonitoringFrame", () => service.startMonitoringFrame(createChromeTabMock(), 0)],
    ["retireAllFrames", () => service.retireAllFrames()],
  ])("warns when %s is invoked", async (method, invoke) => {
    await invoke();

    expect(logService.warning).toHaveBeenCalledTimes(1);
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining(`NoopAutofillLifecycleService.${method}`),
    );
  });

  it("withholds the tab and frame entirely so no tab data reaches the log", async () => {
    const tab = createChromeTabMock({ id: 8675309, url: "https://secret.example/abc" });

    await service.startMonitoringFrame(tab, 90210);

    // A single string argument — no second arg can smuggle the tab object into
    // the log behind the message.
    const call = logService.warning.mock.calls[0];
    expect(call).toHaveLength(1);

    const [message] = call;
    expect(message).not.toContain("secret.example");
    expect(message).not.toContain("https");
    expect(message).not.toContain("8675309");
    expect(message).not.toContain("90210");
  });
});
