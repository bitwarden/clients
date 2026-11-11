import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import type { webauthn } from "@bitwarden/desktop-napi";

import { AutomationWebAuthnRequest } from "./automation-webauthn-message";
import {
  AutomationWebAuthnCancellation,
  AutomationWebAuthnService,
} from "./automation-webauthn.service";

describe("AutomationWebAuthnService", () => {
  const request: webauthn.AssertionRequest = {
    origin: "https://localhost:8080",
    rpId: "localhost",
    challenge: new Uint8Array([1, 2, 3]),
    allowCredentials: [{ id: new Uint8Array([4, 5, 6]), transports: ["internal"] }],
    userVerification: "required",
    timeout: 60000,
    prf: { first: new Uint8Array([7]) },
  };

  let service: AutomationWebAuthnService;
  let cancellation: AutomationWebAuthnCancellation;
  let requests: AutomationWebAuthnRequest[];

  beforeEach(() => {
    service = new AutomationWebAuthnService(mock<LogService>());
    cancellation = new AutomationWebAuthnCancellation();
    requests = [];
    service.requests$.subscribe((r) => requests.push(r));
  });

  it("lists a waiting request with its bytes as base64url", () => {
    void service.getAssertion(request, cancellation);

    const expected = {
      id: "1",
      origin: "https://localhost:8080",
      rpId: "localhost",
      challenge: "AQID",
      allowCredentials: [{ id: "BAUG", transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
      prf: { first: "Bw", second: undefined },
      appId: undefined,
    };
    expect(service.listPendingRequests()).toEqual([expected]);
    expect(requests).toEqual([expected]);
  });

  it("answers the request with the response's bytes", async () => {
    const result = service.getAssertion(request, cancellation);

    expect(
      service.respond("1", {
        credentialId: "BAUG",
        clientDataJson: "AQ",
        authenticatorData: "Ag",
        signature: "Aw",
        userHandle: "BA",
        prf: { first: "BQ" },
      }),
    ).toBe(true);

    await expect(result).resolves.toEqual({
      response: {
        credentialId: new Uint8Array([4, 5, 6]),
        clientDataJson: new Uint8Array([1]),
        authenticatorData: new Uint8Array([2]),
        signature: new Uint8Array([3]),
        userHandle: new Uint8Array([4]),
        authenticatorAttachment: undefined,
        prf: { first: new Uint8Array([5]), second: undefined },
        appIdUsed: undefined,
      },
    });
    expect(service.listPendingRequests()).toEqual([]);
  });

  it("fails the request with the given error", async () => {
    const result = service.getAssertion(request, cancellation);

    expect(service.reject("1", { name: "NotAllowedError", message: "Cancelled" })).toBe(true);

    await expect(result).resolves.toEqual({
      error: { name: "NotAllowedError", message: "Cancelled" },
    });
  });

  it("ends the request with an AbortError when it's cancelled", async () => {
    const result = service.getAssertion(request, cancellation);

    cancellation.cancel();

    await expect(result).resolves.toEqual({
      error: { name: "AbortError", message: "The request was cancelled." },
    });
    expect(service.listPendingRequests()).toEqual([]);
  });

  it("doesn't answer a request that isn't waiting", () => {
    expect(service.reject("1", { name: "NotAllowedError", message: "Cancelled" })).toBe(false);
  });
});
