import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";
import { ZXCVBNResult } from "zxcvbn";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherHealthView } from "../../../../access-intelligence/models";

import { DefaultCipherHealthService } from "./default-cipher-health.service";

describe("DefaultCipherHealthService", () => {
  let service: DefaultCipherHealthService;
  let auditService: MockProxy<AuditService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;

  beforeEach(() => {
    auditService = mock<AuditService>();
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    service = new DefaultCipherHealthService(auditService, passwordStrengthService);
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

  describe("checkSingleCipherHealth", () => {
    it("should detect weak passwords and provide UI helper methods", (done) => {
      const cipher = createMockCipher({ password: "password123" });
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 1 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(0);

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.hasWeakPassword).toBe(true);
        expect(health.weakPasswordScore).toBe(1);

        // Verify helper methods work
        expect(health.getPasswordStrengthLabel()).toBe("veryWeak");
        expect(health.getPasswordStrengthBadgeVariant()).toBe("danger");
        expect(health.isAtRisk()).toBe(true);
        done();
      });
    });

    it("should detect exposed passwords", (done) => {
      const cipher = createMockCipher({ password: "Password123!" });
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 3 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(5);

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.hasExposedPassword).toBe(true);
        expect(health.exposedCount).toBe(5);
        expect(health.hasWeakPassword).toBe(false); // Score 3 is not weak
        expect(health.getPasswordStrengthLabel()).toBe("good");
        expect(health.getPasswordStrengthBadgeVariant()).toBe("primary");
        done();
      });
    });

    it("should handle strong passwords correctly", (done) => {
      const cipher = createMockCipher({ password: "Xk9#mP2$vL8@qR4!" });
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 4 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(0);

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.hasWeakPassword).toBe(false);
        expect(health.hasExposedPassword).toBe(false);
        expect(health.weakPasswordScore).toBe(4);
        expect(health.getPasswordStrengthLabel()).toBe("strong");
        expect(health.getPasswordStrengthBadgeVariant()).toBe("success");
        expect(health.isAtRisk()).toBe(false);
        done();
      });
    });

    it("should return safe defaults for invalid cipher", (done) => {
      const cipher = mock<CipherView>({
        id: "invalid-cipher",
        type: CipherType.Card, // Not a login cipher
        isDeleted: false,
        viewPassword: true,
      });

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.cipherId).toBe("invalid-cipher");
        expect(health.hasWeakPassword).toBe(false);
        expect(health.hasReusedPassword).toBe(false);
        expect(health.hasExposedPassword).toBe(false);
        expect(health.exposedCount).toBe(0);
        done();
      });
    });

    it("should return safe defaults for cipher with no password", (done) => {
      const cipher = mock<CipherView>({
        id: "no-password",
        type: CipherType.Login,
        login: { password: undefined },
        isDeleted: false,
        viewPassword: true,
      });

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.hasWeakPassword).toBe(false);
        expect(health.hasReusedPassword).toBe(false);
        expect(health.hasExposedPassword).toBe(false);
        done();
      });
    });
  });

  describe("detectPasswordReuse", () => {
    it("should detect password reuse", (done) => {
      const ciphers = [
        createMockCipher({ id: "1", password: "SharedPassword" }),
        createMockCipher({ id: "2", password: "SharedPassword" }),
        createMockCipher({ id: "3", password: "UniquePassword" }),
      ];

      service.detectPasswordReuse(ciphers).subscribe((reuseMap) => {
        expect(reuseMap.size).toBe(1);
        expect(reuseMap.get("SharedPassword")).toEqual(["1", "2"]);
        expect(reuseMap.has("UniquePassword")).toBe(false); // Unique passwords excluded
        done();
      });
    });

    it("should return empty map when no passwords are reused", (done) => {
      const ciphers = [
        createMockCipher({ id: "1", password: "Password1" }),
        createMockCipher({ id: "2", password: "Password2" }),
        createMockCipher({ id: "3", password: "Password3" }),
      ];

      service.detectPasswordReuse(ciphers).subscribe((reuseMap) => {
        expect(reuseMap.size).toBe(0);
        done();
      });
    });

    it("should handle multiple sets of reused passwords", (done) => {
      const ciphers = [
        createMockCipher({ id: "1", password: "Password1" }),
        createMockCipher({ id: "2", password: "Password1" }),
        createMockCipher({ id: "3", password: "Password2" }),
        createMockCipher({ id: "4", password: "Password2" }),
        createMockCipher({ id: "5", password: "Password2" }),
        createMockCipher({ id: "6", password: "Unique" }),
      ];

      service.detectPasswordReuse(ciphers).subscribe((reuseMap) => {
        expect(reuseMap.size).toBe(2);
        expect(reuseMap.get("Password1")).toEqual(["1", "2"]);
        expect(reuseMap.get("Password2")).toEqual(["3", "4", "5"]);
        expect(reuseMap.has("Unique")).toBe(false);
        done();
      });
    });
  });

  describe("checkCipherHealth", () => {
    beforeEach(() => {
      // Default mocks
      passwordStrengthService.getPasswordStrength.mockReturnValue({ score: 3 } as ZXCVBNResult);
      auditService.passwordLeaked.mockResolvedValue(0);
    });

    it("should return empty map for empty cipher array", (done) => {
      service.checkCipherHealth([]).subscribe((healthMap) => {
        expect(healthMap.size).toBe(0);
        done();
      });
    });

    it("should check health for all ciphers with password reuse detection", (done) => {
      const ciphers = [
        createMockCipher({ id: "1", password: "SharedWeak" }),
        createMockCipher({ id: "2", password: "SharedWeak" }),
        createMockCipher({ id: "3", password: "StrongUnique" }),
      ];

      passwordStrengthService.getPasswordStrength.mockImplementation((password: string) => {
        return { score: password === "SharedWeak" ? 1 : 4 } as ZXCVBNResult;
      });

      service.checkCipherHealth(ciphers).subscribe((healthMap) => {
        expect(healthMap.size).toBe(3);

        const health1 = healthMap.get("1");
        expect(health1?.hasWeakPassword).toBe(true);
        expect(health1?.hasReusedPassword).toBe(true); // SharedWeak is reused
        expect(health1?.isAtRisk()).toBe(true);

        const health2 = healthMap.get("2");
        expect(health2?.hasWeakPassword).toBe(true);
        expect(health2?.hasReusedPassword).toBe(true); // SharedWeak is reused

        const health3 = healthMap.get("3");
        expect(health3?.hasWeakPassword).toBe(false);
        expect(health3?.hasReusedPassword).toBe(false); // StrongUnique is unique
        expect(health3?.isAtRisk()).toBe(false);

        done();
      });
    });

    it("should limit concurrent HIBP calls", async () => {
      const ciphers = Array.from({ length: 20 }, (_, i) =>
        createMockCipher({ id: `${i}`, password: `password${i}` }),
      );

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      auditService.passwordLeaked.mockImplementation(() => {
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

      expect(maxConcurrent).toBeLessThanOrEqual(5);
    });

    it("should filter out invalid ciphers", (done) => {
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

      service.checkCipherHealth(ciphers).subscribe((healthMap) => {
        expect(healthMap.size).toBe(2);
        expect(healthMap.has("1")).toBe(true);
        expect(healthMap.has("2")).toBe(false); // Invalid cipher excluded
        expect(healthMap.has("3")).toBe(true);
        done();
      });
    });

    it("should detect exposed passwords with count", (done) => {
      const ciphers = [
        createMockCipher({ id: "1", password: "ExposedPassword" }),
        createMockCipher({ id: "2", password: "SafePassword" }),
      ];

      auditService.passwordLeaked.mockImplementation((password: string) => {
        return Promise.resolve(password === "ExposedPassword" ? 42 : 0);
      });

      service.checkCipherHealth(ciphers).subscribe((healthMap) => {
        const health1 = healthMap.get("1");
        expect(health1?.hasExposedPassword).toBe(true);
        expect(health1?.exposedCount).toBe(42);

        const health2 = healthMap.get("2");
        expect(health2?.hasExposedPassword).toBe(false);
        expect(health2?.exposedCount).toBe(0);

        done();
      });
    });
  });

  describe("CipherHealthView helper methods", () => {
    it("should provide correct labels for all password strength scores", (done) => {
      const testCases = [
        { score: 0, label: "veryWeak", badge: "danger" as const },
        { score: 1, label: "veryWeak", badge: "danger" as const },
        { score: 2, label: "weak", badge: "warning" as const },
        { score: 3, label: "good", badge: "primary" as const },
        { score: 4, label: "strong", badge: "success" as const },
      ];

      let completed = 0;

      testCases.forEach(({ score, label, badge }) => {
        const cipher = createMockCipher({ password: `password-score-${score}` });
        passwordStrengthService.getPasswordStrength.mockReturnValue({ score } as ZXCVBNResult);
        auditService.passwordLeaked.mockResolvedValue(0);

        service.checkSingleCipherHealth(cipher).subscribe((health) => {
          expect(health.weakPasswordScore).toBe(score);
          expect(health.getPasswordStrengthLabel()).toBe(label);
          expect(health.getPasswordStrengthBadgeVariant()).toBe(badge);
          expect(health.hasWeakPassword).toBe(score <= 2);

          completed++;
          if (completed === testCases.length) {
            done();
          }
        });
      });
    });

    it("should handle missing password score gracefully", (done) => {
      const cipher = mock<CipherView>({
        id: "no-password",
        type: CipherType.Login,
        login: { password: undefined },
        isDeleted: false,
        viewPassword: true,
      });

      service.checkSingleCipherHealth(cipher).subscribe((health) => {
        expect(health.weakPasswordScore).toBeUndefined();
        expect(health.getPasswordStrengthLabel()).toBe("unknown");
        expect(health.getPasswordStrengthBadgeVariant()).toBe("warning");
        done();
      });
    });

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
