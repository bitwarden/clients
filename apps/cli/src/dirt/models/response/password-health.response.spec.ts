import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { PasswordHealthResponse } from "./password-health.response";

describe("PasswordHealthResponse", () => {
  const buildResult = (overrides: Partial<CipherRiskResult> = {}): CipherRiskResult => ({
    id: "cipher-1" as unknown as CipherRiskResult["id"],
    password_strength: 4,
    exposed_result: { type: "NotChecked" },
    reuse_count: undefined,
    ...overrides,
  });

  it("reports exposed=false with null count for a successfully-checked password with zero breaches", () => {
    const result = buildResult({ exposed_result: { type: "Found", value: 0 } });
    const response = new PasswordHealthResponse(result, "Unique Password Item");

    expect(response.exposed).toBe(false);
    expect(response.exposedCount).toBeNull();
  });

  it("reports exposed=true with the real count when Found(n>0)", () => {
    const result = buildResult({ exposed_result: { type: "Found", value: 2266543 } });
    const response = new PasswordHealthResponse(result, "Breached Password Item");

    expect(response.exposed).toBe(true);
    expect(response.exposedCount).toBe(2266543);
  });

  it("reports exposed=false with null count for NotChecked", () => {
    const result = buildResult({ exposed_result: { type: "NotChecked" } });
    const response = new PasswordHealthResponse(result, "Skipped Item");

    expect(response.exposed).toBe(false);
    expect(response.exposedCount).toBeNull();
  });

  it("reports exposed=false with exposedError set for Error", () => {
    const result = buildResult({ exposed_result: { type: "Error", value: "HIBP down" } });
    const response = new PasswordHealthResponse(result, "Errored Item");

    expect(response.exposed).toBe(false);
    expect(response.exposedCount).toBeNull();
    expect(response.exposedError).toBe("HIBP down");
  });
});
