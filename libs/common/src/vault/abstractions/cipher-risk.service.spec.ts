import type { CipherRiskResult, CipherId } from "@bitwarden/sdk-internal";

import { isPasswordAtRisk } from "./cipher-risk.service";

describe("isPasswordAtRisk", () => {
  const mockId = "00000000-0000-0000-0000-000000000000" as unknown as CipherId;

  const createRisk = (overrides: Partial<CipherRiskResult> = {}): CipherRiskResult => ({
    id: mockId,
    password_strength: 4,
    exposed_result: { type: "NotChecked" },
    reuse_count: 1,
    ...overrides,
  });

  describe("exposed password risk", () => {
    it.each([
      { value: 5, expected: true, desc: "found with value > 0" },
      { value: 0, expected: false, desc: "found but value is 0" },
    ])("should return $expected when password is $desc", ({ value, expected }) => {
      const risk = createRisk({ exposed_result: { type: "Found", value } });
      expect(isPasswordAtRisk(risk)).toBe(expected);
    });

    it("should return false when password is not checked", () => {
      expect(isPasswordAtRisk(createRisk())).toBe(false);
    });
  });

  describe("password reuse risk", () => {
    it.each([
      { count: 2, expected: true, desc: "reused (reuse_count > 1)" },
      { count: 1, expected: false, desc: "not reused" },
      { count: undefined, expected: false, desc: "undefined" },
    ])("should return $expected when reuse_count is $desc", ({ count, expected }) => {
      const risk = createRisk({ reuse_count: count });
      expect(isPasswordAtRisk(risk)).toBe(expected);
    });
  });

  describe("password strength risk", () => {
    it.each([
      { strength: 0, expected: true },
      { strength: 1, expected: true },
      { strength: 2, expected: true },
      { strength: 3, expected: false },
      { strength: 4, expected: false },
    ])("should return $expected when password strength is $strength", ({ strength, expected }) => {
      const risk = createRisk({ password_strength: strength });
      expect(isPasswordAtRisk(risk)).toBe(expected);
    });
  });

  describe("multiple risk factors", () => {
    it.each<{ desc: string; overrides: Partial<CipherRiskResult>; expected: boolean }>([
      {
        desc: "exposed and reused",
        overrides: {
          exposed_result: { type: "Found" as const, value: 3 },
          reuse_count: 2,
        },
        expected: true,
      },
      {
        desc: "reused and weak strength",
        overrides: { password_strength: 2, reuse_count: 2 },
        expected: true,
      },
      {
        desc: "all three risk factors",
        overrides: {
          password_strength: 1,
          exposed_result: { type: "Found" as const, value: 10 },
          reuse_count: 3,
        },
        expected: true,
      },
      {
        desc: "no risk factors",
        overrides: { reuse_count: undefined },
        expected: false,
      },
    ])("should return $expected when $desc present", ({ overrides, expected }) => {
      const risk = createRisk(overrides);
      expect(isPasswordAtRisk(risk)).toBe(expected);
    });
  });
});
