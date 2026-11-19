import { PamUnreachableError } from "@bitwarden/bit-pam";

import { PamCallOutcomeReporter } from "./desktop-pam-connectivity.service";
import { PAM_CALL_TIMEOUT_MS, classifyPamFailure, guardPamCalls } from "./pam-call-guard";

class FakeSdk {
  pending = new Promise<string>(() => undefined);
  next: () => Promise<string> = () => Promise.resolve("ok");

  read(): Promise<string> {
    return this.next();
  }

  hang(): Promise<string> {
    return this.pending;
  }

  label(): string {
    return "sync";
  }
}

function sdkError(message: string): Error {
  const error = new Error(message);
  error.name = "AccessRequestError";
  return error;
}

describe("classifyPamFailure", () => {
  it.each([
    "error sending request for url (https://vault.example/api/pam/requests)",
    "TypeError: Failed to fetch",
    "net::ERR_INTERNET_DISCONNECTED",
    "Received error message from server: [503] Service Unavailable",
    "Received error message from server: [504] ",
  ])("reads %p as a network failure", (message) => {
    expect(classifyPamFailure(sdkError(message))).toBe("network");
  });

  it.each([
    'Received error message from server: [400] {"message":"This request has already been resolved."}',
    "Received error message from server: [403] Forbidden",
    "Received error message from server: [404] ",
    '{"message":"A Privileged Controls license is required to access this item."}',
  ])("reads %p as a server refusal", (message) => {
    expect(classifyPamFailure(sdkError(message))).toBe("server");
  });

  it("reads a local failure as neither", () => {
    expect(classifyPamFailure(new Error("No active user"))).toBe("other");
  });

  it("reads a status with a transport-like body as the server's answer", () => {
    expect(
      classifyPamFailure(sdkError("Received error message from server: [400] failed to fetch")),
    ).toBe("server");
  });
});

describe("guardPamCalls", () => {
  let sdk: FakeSdk;
  let reporter: PamCallOutcomeReporter & {
    reportReachable: jest.Mock;
    reportUnreachable: jest.Mock;
    browserOffline: boolean;
  };
  let guarded: FakeSdk;

  beforeEach(() => {
    jest.useFakeTimers();
    sdk = new FakeSdk();
    reporter = {
      reportReachable: jest.fn(),
      reportUnreachable: jest.fn(),
      browserOffline: false,
    };
    guarded = guardPamCalls(sdk, reporter);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves a call that answers and reports the server reachable", async () => {
    await expect(guarded.read()).resolves.toBe("ok");
    expect(reporter.reportReachable).toHaveBeenCalled();
  });

  it("leaves a method that returns no promise alone", () => {
    expect(guarded.label()).toBe("sync");
  });

  it("ends a call with no answer at the timeout, as unreachable", async () => {
    const call = guarded.hang();
    const settled = jest.fn();
    call.catch(settled);

    jest.advanceTimersByTime(PAM_CALL_TIMEOUT_MS - 1);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await expect(call).rejects.toBeInstanceOf(PamUnreachableError);
    await expect(call).rejects.toMatchObject({ reason: "timeout" });
    expect(reporter.reportUnreachable).toHaveBeenCalled();
  });

  it("turns a transport failure into an unreachable error, keeping the original", async () => {
    const original = sdkError("error sending request for url (https://vault.example)");
    sdk.next = () => Promise.reject(original);

    const call = guarded.read();

    await expect(call).rejects.toMatchObject({ name: "PamUnreachableError", reason: "network" });
    await expect(call).rejects.toMatchObject({ original });
    expect(reporter.reportUnreachable).toHaveBeenCalled();
  });

  it("rethrows a server refusal unchanged, and reports the server reachable", async () => {
    const refusal = sdkError('Received error message from server: [409] {"message":"No."}');
    sdk.next = () => Promise.reject(refusal);

    await expect(guarded.read()).rejects.toBe(refusal);
    expect(reporter.reportReachable).toHaveBeenCalled();
    expect(reporter.reportUnreachable).not.toHaveBeenCalled();
  });

  it("rethrows a local failure unchanged without touching reachability", async () => {
    const local = new Error("No active user");
    sdk.next = () => Promise.reject(local);

    await expect(guarded.read()).rejects.toBe(local);
    expect(reporter.reportReachable).not.toHaveBeenCalled();
    expect(reporter.reportUnreachable).not.toHaveBeenCalled();
  });

  it("treats any failure as a network failure while the browser has no network", async () => {
    reporter.browserOffline = true;
    sdk.next = () => Promise.reject(new Error("something odd"));

    await expect(guarded.read()).rejects.toBeInstanceOf(PamUnreachableError);
  });

  it("never retries a failed call", async () => {
    const read = jest.fn().mockRejectedValue(sdkError("Failed to fetch"));
    sdk.next = read;

    await expect(guarded.read()).rejects.toBeInstanceOf(PamUnreachableError);
    jest.advanceTimersByTime(PAM_CALL_TIMEOUT_MS * 10);

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("clears the timer once a call settles, leaving no timer behind", async () => {
    await guarded.read();

    expect(jest.getTimerCount()).toBe(0);
  });
});
