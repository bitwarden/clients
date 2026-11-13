import type { RotationConfigView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

import { parseRotationRequest } from "./rotation-request";

const CIPHER = "33333333-3333-4333-8333-333333333333";
const TARGET = "44444444-4444-4444-8444-444444444444";

const existing = {
  cipherId: CIPHER,
  targetSystemId: TARGET,
  sealed: { accountIdentity: "stored-identity", terminateSessions: true },
  scheduleCron: "0 0 0 * * ?",
  rotateOnAccessEnd: true,
} as unknown as RotationConfigView;

describe("parseRotationRequest", () => {
  it("parses a full request", () => {
    const request = parseRotationRequest(
      JSON.stringify({
        cipherId: CIPHER.toUpperCase(),
        targetSystemId: TARGET,
        accountIdentity: "svc-account",
        terminateSessions: true,
        scheduleCron: "0 0 3 * * ?",
        rotateOnAccessEnd: true,
      }),
    );
    expect(request).toEqual({
      cipherId: CIPHER,
      targetSystemId: TARGET,
      accountIdentity: "svc-account",
      terminateSessions: true,
      scheduleCron: "0 0 3 * * ?",
      rotateOnAccessEnd: true,
    });
  });

  it("defaults the booleans to false and the schedule to none on create", () => {
    const request = parseRotationRequest(
      JSON.stringify({ cipherId: CIPHER, targetSystemId: TARGET, accountIdentity: "a" }),
    );
    expect(request.terminateSessions).toBe(false);
    expect(request.rotateOnAccessEnd).toBe(false);
    expect(request.scheduleCron).toBeUndefined();
  });

  it("keeps existing values for omitted fields on update, and lets null clear the schedule", () => {
    const kept = parseRotationRequest("{}", existing);
    expect(kept).toEqual({
      cipherId: CIPHER,
      targetSystemId: TARGET,
      accountIdentity: "stored-identity",
      terminateSessions: true,
      scheduleCron: "0 0 0 * * ?",
      rotateOnAccessEnd: true,
    });
    expect(parseRotationRequest('{"scheduleCron":null}', existing).scheduleCron).toBeUndefined();
  });

  it("refuses an update that omits terminateSessions when the existing one could not be read", () => {
    const unreadable = { ...existing, sealed: undefined } as unknown as RotationConfigView;
    const body = JSON.stringify({ accountIdentity: "new-identity" });

    expect(() => parseRotationRequest(body, unreadable)).toThrow(PamInputError);
    expect(() => parseRotationRequest(body, unreadable)).toThrow(/terminateSessions/);
  });

  it("accepts an explicit terminateSessions when the existing sealed data could not be read", () => {
    const unreadable = { ...existing, sealed: undefined } as unknown as RotationConfigView;
    const request = parseRotationRequest(
      JSON.stringify({ accountIdentity: "new-identity", terminateSessions: false }),
      unreadable,
    );
    expect(request.terminateSessions).toBe(false);
  });

  it("refuses bad input without repeating the account identity", () => {
    const secret = "very-secret-identity";
    const bodies = [
      `{"cipherId":"${CIPHER}","targetSystemId":"${TARGET}","accountIdentity":"${secret}","extra":1}`,
      `{"cipherId":"nope","targetSystemId":"${TARGET}","accountIdentity":"${secret}"}`,
      `{"cipherId":"${CIPHER}","targetSystemId":"${TARGET}","accountIdentity":"${secret}","terminateSessions":"yes"}`,
      `{"cipherId":"${CIPHER}","targetSystemId":"${TARGET}","accountIdentity":"${secret.repeat(40)}"}`,
      `{"accountIdentity":"${secret}"`,
      `[]`,
    ];
    for (const body of bodies) {
      let error: unknown;
      try {
        parseRotationRequest(body);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(PamInputError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("requires an account identity when none can be read", () => {
    expect(() =>
      parseRotationRequest("{}", { ...existing, sealed: undefined } as RotationConfigView),
    ).toThrow("accountIdentity");
  });
});
