import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import { CipherHealthView } from "../../../../access-intelligence/models";

import { DefaultCipherHealthService } from "./default-cipher-health.service";

describe("DefaultCipherHealthService", () => {
  let service: DefaultCipherHealthService;
  let auditService: MockProxy<AuditService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    auditService = mock<AuditService>();
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));
    logService = mock<LogService>();
    service = new DefaultCipherHealthService(
      auditService,
      passwordStrengthService,
      configService,
      logService,
    );
  });

  // Helper to create mock ciphers
  const createMockCipher = (options: {
    id?: string;
    password?: string;
    username?: string;
  }): CipherView => {
    return mock<CipherView>({
      id: options.id ?? "cipher-id",
      type: CipherType.Login,
      login: {
        password: options.password ?? "password123",
        username: options.username ?? "user@example.com",
      },
      isDeleted: false,
      viewPassword: true,
    });
  };

  describe("HIBP padding", () => {
    beforeEach(() => {
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 3 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(0);
    });

    it("should request padding on the flag-off path", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const cipher = createMockCipher({ password: "Password123!" });

      await firstValueFrom(service.checkCipherHealth([cipher]));

      expect(auditService.passwordLeaked).toHaveBeenCalledWith("Password123!", true);
    });

    it("should not request padding on the flag-on path", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      auditService.passwordLeakedStrict.mockResolvedValue(0);
      const cipher = createMockCipher({ password: "Password123!" });

      await firstValueFrom(service.checkCipherHealth([cipher]));

      expect(auditService.passwordLeakedStrict).toHaveBeenCalledWith("Password123!", false);
    });
  });

  describe("checkCipherHealth", () => {
    beforeEach(() => {
      // Default mocks
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 3 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(0);
      auditService.passwordLeakedStrict.mockResolvedValue(0);
    });

    it("should return empty map for empty cipher array", (done) => {
      service.checkCipherHealth([]).subscribe((healthMap) => {
        expect(healthMap.size).toBe(0);
        done();
      });
    });

    it.each([true, false])(
      "should check health for all ciphers with password reuse detection (flagEnabled=%s)",
      async (flagEnabled) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagEnabled));
        const ciphers = [
          createMockCipher({ id: "1", password: "SharedWeak" }),
          createMockCipher({ id: "2", password: "SharedWeak" }),
          createMockCipher({ id: "3", password: "StrongUnique" }),
        ];

        passwordStrengthService.getPasswordStrength.mockImplementation((password: string) => {
          return { score: password === "SharedWeak" ? 1 : 4 } as ZXCVBNResult;
        });

        const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));
        expect(healthMap.size).toBe(3);

        const health1 = healthMap.get("1");
        expect(health1?.hasWeakPassword).toBe(true);
        expect(health1?.hasReusedPassword).toBe(true); // SharedWeak is reused
        // The count is how many ciphers share the password, so the reuse flag is never
        // set without a count the detail view can show alongside it.
        expect(health1?.reuseCount).toBe(2);
        expect(health1?.isAtRisk()).toBe(true);

        const health2 = healthMap.get("2");
        expect(health2?.hasWeakPassword).toBe(true);
        expect(health2?.hasReusedPassword).toBe(true); // SharedWeak is reused
        expect(health2?.reuseCount).toBe(2);

        const health3 = healthMap.get("3");
        expect(health3?.hasWeakPassword).toBe(false);
        expect(health3?.hasReusedPassword).toBe(false); // StrongUnique is unique
        expect(health3?.reuseCount).toBe(0);
        expect(health3?.isAtRisk()).toBe(false);
      },
    );

    it("should look up each distinct password once rather than each cipher", async () => {
      // Reuse is the premise of the report, so lookups track distinct passwords. Every request
      // also costs a CORS preflight, making each one saved worth two round trips.
      const ciphers = [
        createMockCipher({ id: "1", password: "shared" }),
        createMockCipher({ id: "2", password: "shared" }),
        createMockCipher({ id: "3", password: "shared" }),
        createMockCipher({ id: "4", password: "unique" }),
      ];

      await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(auditService.passwordLeakedStrict).toHaveBeenCalledTimes(2);
      expect(auditService.passwordLeakedStrict).toHaveBeenCalledWith("shared", false);
      expect(auditService.passwordLeakedStrict).toHaveBeenCalledWith("unique", false);
    });

    it("should look up each cipher separately when the flag is off", async () => {
      // The flag-off arm is the measurement baseline, so it has to keep costing one lookup per
      // cipher. If this matches the flag-on count, the before/after comparison proves nothing.
      configService.getFeatureFlag$.mockReturnValue(of(false));
      const ciphers = [
        createMockCipher({ id: "1", password: "shared" }),
        createMockCipher({ id: "2", password: "shared" }),
        createMockCipher({ id: "3", password: "shared" }),
        createMockCipher({ id: "4", password: "unique" }),
      ];

      const health = await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(auditService.passwordLeaked).toHaveBeenCalledTimes(4);
      expect(health.size).toBe(4);
    });

    it("should report the same reuse counts on both sides of the flag", async () => {
      const ciphers = [
        createMockCipher({ id: "1", password: "shared" }),
        createMockCipher({ id: "2", password: "shared" }),
        createMockCipher({ id: "3", password: "unique" }),
      ];

      configService.getFeatureFlag$.mockReturnValue(of(true));
      const grouped = await firstValueFrom(service.checkCipherHealth(ciphers));

      configService.getFeatureFlag$.mockReturnValue(of(false));
      const perCipher = await firstValueFrom(service.checkCipherHealth(ciphers));

      for (const id of ["1", "2", "3"]) {
        expect(perCipher.get(id)!.reuseCount).toBe(grouped.get(id)!.reuseCount);
        expect(perCipher.get(id)!.hasReusedPassword).toBe(grouped.get(id)!.hasReusedPassword);
      }
    });

    it("should apply one lookup result to every cipher sharing the password", async () => {
      const ciphers = [
        createMockCipher({ id: "1", password: "shared" }),
        createMockCipher({ id: "2", password: "shared" }),
        createMockCipher({ id: "3", password: "unique" }),
      ];

      auditService.passwordLeakedStrict.mockImplementation((password: string) =>
        Promise.resolve(password === "shared" ? 42 : 0),
      );

      const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(healthMap.size).toBe(3);
      expect(healthMap.get("1")?.exposedCount).toBe(42);
      expect(healthMap.get("2")?.exposedCount).toBe(42);
      expect(healthMap.get("1")?.hasExposedPassword).toBe(true);
      expect(healthMap.get("3")?.exposedCount).toBe(0);
      expect(healthMap.get("3")?.hasExposedPassword).toBe(false);
    });

    it("should score strength as each lookup resolves, not after the whole batch", async () => {
      // zxcvbn is synchronous and costs about a millisecond per cipher. Scoring the whole vault
      // after the last lookup returns lands as one visible freeze; scoring per group fills the gaps
      // between network responses instead.
      const ciphers = [
        createMockCipher({ id: "1", password: "fast" }),
        createMockCipher({ id: "2", password: "slow" }),
      ];

      let releaseSlowLookup: (count: number) => void = () => {};
      const slowLookup = new Promise<number>((resolve) => {
        releaseSlowLookup = resolve;
      });
      auditService.passwordLeakedStrict.mockImplementation((password: string) =>
        password === "slow" ? slowLookup : Promise.resolve(0),
      );

      const scored: string[] = [];
      passwordStrengthService.getPasswordStrength.mockImplementation((password: string) => {
        scored.push(password);
        return { score: 3 } as ZXCVBNResult;
      });

      const healthMap = firstValueFrom(service.checkCipherHealth(ciphers));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(scored).toEqual(["fast"]);

      releaseSlowLookup(0);
      await healthMap;

      expect(scored).toEqual(["fast", "slow"]);
    });

    it("should complete the batch when an exposure check fails", async () => {
      // A single rejection used to cancel the whole fan-out, discarding every lookup that had
      // already succeeded and failing report generation outright.
      const ciphers = [
        createMockCipher({ id: "1", password: "first" }),
        createMockCipher({ id: "2", password: "unreachable" }),
        createMockCipher({ id: "3", password: "third" }),
      ];

      auditService.passwordLeakedStrict.mockImplementation((password: string) =>
        password === "unreachable" ? Promise.reject(new Error("network down")) : Promise.resolve(7),
      );

      const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(healthMap.size).toBe(3);
      expect(healthMap.get("1")?.exposedCount).toBe(7);
      expect(healthMap.get("3")?.exposedCount).toBe(7);

      const failed = healthMap.get("2");
      expect(failed?.hasExposedPassword).toBe(false);
      expect(failed?.exposedCount).toBe(0);
    });

    it("should keep the strength result for a cipher whose exposure check fails", async () => {
      const ciphers = [createMockCipher({ id: "1", password: "unreachable" })];

      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 1 } as ZXCVBNResult);
      auditService.passwordLeakedStrict.mockRejectedValue(new Error("network down"));

      const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(healthMap.get("1")?.hasWeakPassword).toBe(true);
      expect(healthMap.get("1")?.weakPasswordScore).toBe(1);
    });

    it("should log once with a count rather than per failed lookup", async () => {
      const ciphers = Array.from({ length: 3 }, (_, i) =>
        createMockCipher({ id: `${i}`, password: `unreachable${i}` }),
      );

      auditService.passwordLeakedStrict.mockRejectedValue(new Error("network down"));

      await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(logService.warning).toHaveBeenCalledTimes(1);
      expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("3 of 3"));
    });

    it("should report the cipher count a failed lookup affects, not the lookup count", async () => {
      // One shared password is one lookup, but the failure degrades every cipher holding it.
      const ciphers = Array.from({ length: 4 }, (_, i) =>
        createMockCipher({ id: `${i}`, password: "shared" }),
      );

      auditService.passwordLeakedStrict.mockRejectedValue(new Error("network down"));

      await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(logService.warning).toHaveBeenCalledWith(
        expect.stringContaining("1 of 1 exposure lookups failed, affecting 4 ciphers"),
      );
    });

    it("should not log when every exposure check succeeds", async () => {
      const ciphers = [createMockCipher({ id: "1", password: "reachable" })];

      await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("should not impose its own concurrency limit", async () => {
      // AuditService owns the only limiter on this path. A second one here would shadow it, and
      // whichever was tighter would silently win, so this service hands off every lookup at once.
      const ciphers = Array.from({ length: 20 }, (_, i) =>
        createMockCipher({ id: `${i}`, password: `password${i}` }),
      );

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      auditService.passwordLeakedStrict.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

        return new Promise((resolve) => {
          setTimeout(() => {
            concurrentCalls--;
            resolve(0);
          }, 10);
        });
      });

      await firstValueFrom(service.checkCipherHealth(ciphers));

      expect(maxConcurrent).toBe(ciphers.length);
    });

    it.each([true, false])(
      "should filter out invalid ciphers (flagEnabled=%s)",
      async (flagEnabled) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagEnabled));
        const ciphers = [
          createMockCipher({ id: "1", password: "Valid" }),
          mock<CipherView>({
            id: "2",
            type: CipherType.Card, // Invalid type
            isDeleted: false,
            viewPassword: true,
          }),
          createMockCipher({ id: "3", password: "AlsoValid" }),
        ];

        const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));
        expect(healthMap.size).toBe(2);
        expect(healthMap.has("1")).toBe(true);
        expect(healthMap.has("2")).toBe(false); // Invalid cipher excluded
        expect(healthMap.has("3")).toBe(true);
      },
    );

    it.each([true, false])(
      "should detect exposed passwords with count (flagEnabled=%s)",
      async (flagEnabled) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagEnabled));
        const ciphers = [
          createMockCipher({ id: "1", password: "ExposedPassword" }),
          createMockCipher({ id: "2", password: "SafePassword" }),
        ];

        const mockImpl = (password: string) =>
          Promise.resolve(password === "ExposedPassword" ? 42 : 0);
        auditService.passwordLeaked.mockImplementation(mockImpl);
        auditService.passwordLeakedStrict.mockImplementation(mockImpl);

        const healthMap = await firstValueFrom(service.checkCipherHealth(ciphers));
        expect(healthMap.get("1")?.hasExposedPassword).toBe(true);
        expect(healthMap.get("1")?.exposedCount).toBe(42);
        expect(healthMap.get("2")?.hasExposedPassword).toBe(false);
        expect(healthMap.get("2")?.exposedCount).toBe(0);
      },
    );
  });

  describe("CipherHealthView helper methods", () => {
    it.each([true, false])(
      "should provide correct labels for all password strength scores (flagEnabled=%s)",
      async (flagEnabled) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagEnabled));

        const testCases = [
          { score: 0, label: "veryWeak", badge: "danger" as const },
          { score: 1, label: "veryWeak", badge: "danger" as const },
          { score: 2, label: "weak", badge: "warning" as const },
          { score: 3, label: "good", badge: "primary" as const },
          { score: 4, label: "strong", badge: "success" as const },
        ];

        for (const { score, label, badge } of testCases) {
          const cipher = createMockCipher({ id: `cipher-${score}`, password: `password-${score}` });
          passwordStrengthService.getPasswordStrength.mockReturnValue({ score } as ZXCVBNResult);
          auditService.passwordLeaked.mockResolvedValue(0);
          auditService.passwordLeakedStrict.mockResolvedValue(0);

          const healthMap = await firstValueFrom(service.checkCipherHealth([cipher]));
          const health = healthMap.get(`cipher-${score}`);

          expect(health?.weakPasswordScore).toBe(score);
          expect(health?.getPasswordStrengthLabel()).toBe(label);
          expect(health?.getPasswordStrengthBadgeVariant()).toBe(badge);
          expect(health?.hasWeakPassword).toBe(score <= 2);
        }
      },
    );

    it.each([true, false])(
      "should handle missing password score gracefully (flagEnabled=%s)",
      async (flagEnabled) => {
        configService.getFeatureFlag$.mockReturnValue(of(flagEnabled));
        const cipher = createMockCipher({ id: "no-score", password: "SomePassword" });
        passwordStrengthService.getPasswordStrength.mockReturnValue({
          score: undefined,
        } as unknown as ZXCVBNResult);
        auditService.passwordLeaked.mockResolvedValue(0);
        auditService.passwordLeakedStrict.mockResolvedValue(0);

        const healthMap = await firstValueFrom(service.checkCipherHealth([cipher]));
        const health = healthMap.get("no-score");

        expect(health?.weakPasswordScore).toBeUndefined();
        expect(health?.getPasswordStrengthLabel()).toBe("unknown");
        expect(health?.getPasswordStrengthBadgeVariant()).toBe("warning");
      },
    );

    it("should correctly identify at-risk passwords", (done) => {
      const testCases = [
        { score: 0, exposed: false, reused: false, expectedAtRisk: true }, // Weak
        { score: 4, exposed: true, reused: false, expectedAtRisk: true }, // Exposed
        { score: 4, exposed: false, reused: true, expectedAtRisk: true }, // Reused
        { score: 4, exposed: false, reused: false, expectedAtRisk: false }, // Safe
      ];

      let completed = 0;

      testCases.forEach(({ score, exposed, reused, expectedAtRisk }) => {
        const health = new CipherHealthView({
          cipherId: "test",
          hasWeakPassword: score <= 2,
          hasExposedPassword: exposed,
          hasReusedPassword: reused,
          exposedCount: exposed ? 1 : 0,
          reuseCount: reused ? 2 : 0,
          weakPasswordScore: score,
        });

        expect(health.isAtRisk()).toBe(expectedAtRisk);

        completed++;
        if (completed === testCases.length) {
          done();
        }
      });
    });
  });
});
