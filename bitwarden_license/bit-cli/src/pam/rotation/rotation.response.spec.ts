import type { RotationConfigView, RotationJob } from "@bitwarden/sdk-internal";

import { RotationConfigResponse, RotationJobResponse } from "./rotation.response";

const config = {
  id: "c",
  organizationId: "o",
  cipherId: "ci",
  targetSystemId: "t",
  targetSystemName: "Name\u001b[31m",
  targetSystemMethod: "automatic",
  sealed: { accountIdentity: "top-secret-identity", terminateSessions: true },
  enabled: true,
  hasActiveJob: false,
  awaitingManualRotation: false,
  rotateOnAccessEnd: false,
  lastRotationAt: "2026-01-01T00:00:00Z",
} as unknown as RotationConfigView;
const actions = {
  canRotateNow: true,
  canRecordManual: false,
  mutationsLocked: false,
  canPause: true,
  canResume: false,
};

describe("RotationConfigResponse", () => {
  it("shows only whether the account identity is set and never sealed fields", () => {
    const response = new RotationConfigResponse({ config, actions });
    const text = JSON.stringify(response);
    expect(response.accountIdentitySet).toBe(true);
    expect(text).not.toContain("top-secret-identity");
    expect(text).not.toContain("terminateSessions");
    expect(response.object).toBe("pam-rotation-config");
    expect(response.targetSystemName).toBe("Name[31m");
    expect(response.lastRotationAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("adds a cipher name only when one was found", () => {
    const names = { cipher: (id: string) => (id === "ci" ? "My login" : id) } as never;
    expect(new RotationConfigResponse({ config, actions }, names).cipherName).toBe("My login");
    const ids = { cipher: (id: string) => id } as never;
    expect(new RotationConfigResponse({ config, actions }, ids).cipherName).toBeUndefined();
  });
});

describe("RotationJobResponse", () => {
  const job = (code: string | undefined, reason: string) =>
    ({
      id: "j",
      source: "on_demand",
      status: "failed",
      createdAt: "2026-01-01T00:00:00Z",
      attempts: [
        { status: "errored", failureCode: code, failureReason: reason, cipherUpdated: false },
      ],
    }) as unknown as RotationJob;

  it("prefers the failure code and hides the reason", () => {
    const response = new RotationJobResponse(job("target_unreachable", "boom"));
    expect(response.failureCode).toBe("target_unreachable");
    expect(response.failureReason).toBeNull();
  });

  it("sanitizes and truncates the reason when there is no code", () => {
    const response = new RotationJobResponse(job(undefined, `\u001b[2J${"x".repeat(500)}`));
    expect(response.failureReason).not.toContain("\u001b");
    expect(Array.from(response.failureReason ?? "").length).toBeLessThanOrEqual(120);
  });
});
