import { mock } from "jest-mock-extended";
import { ZXCVBNResult } from "zxcvbn";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { PasswordHealthService } from "./password-health.service";

describe("PasswordHealthService", () => {
  let service: PasswordHealthService;

  // Mock services
  const passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
  const auditService = mock<AuditService>();

  // Mock data
  let mockValidCipher: CipherView;
  let mockInvalidCipher: CipherView;
  let mockExposedCiphers: CipherView[];

  beforeEach(() => {
    // Setup mock service implementations
    passwordStrengthService.getPasswordStrength.mockImplementation((password: string) => {
      return { score: password === "weak" ? 1 : 4 } as ZXCVBNResult;
    });
    auditService.passwordLeaked.mockImplementation((password: string) =>
      Promise.resolve(password === "leaked" ? 2 : 0),
    );
    service = new PasswordHealthService(passwordStrengthService, auditService);

    // Setup mock data
    mockValidCipher = mock<CipherView>({
      type: CipherType.Login,
      login: { password: "weak", username: "user" },
      isDeleted: false,
      viewPassword: true,
    });
    mockInvalidCipher = mock<CipherView>({
      type: CipherType.Card,
      login: { password: "" },
      isDeleted: true,
      viewPassword: false,
    });
    mockExposedCiphers = [
      mock<CipherView>({
        id: "cipher-id-1",
        type: CipherType.Login,
        login: { password: "leaked", username: "user" },
        isDeleted: false,
        viewPassword: true,
      }),
      mock<CipherView>({
        id: "cipher-id-2",
        type: CipherType.Login,
        login: { password: "safe", username: "user" },
        isDeleted: false,
        viewPassword: true,
      }),
    ];
  });

  it("should extract username parts", () => {
    expect(service.extractUsernameParts("john.doe@example.com")).toEqual(["john", "doe"]);
    expect(service.extractUsernameParts("a@b.com")).toEqual(["a"]);
    expect(service.extractUsernameParts("user_name")).toEqual(["user", "name"]);
  });

  it("should identify weak passwords", () => {
    const result = service.findWeakPasswordDetails(mockValidCipher);
    expect(result).toEqual({
      score: 1,
      detailValue: { label: "veryWeak", badgeVariant: "danger" },
    });
  });

  it("should return null for invalid cipher in findWeakPasswordDetails", () => {
    const cipher = { type: CipherType.Card } as any;
    expect(service.findWeakPasswordDetails(cipher)).toBeNull();
  });

  it("should get password score info", () => {
    expect(service.getPasswordScoreInfo(4)).toEqual({ label: "strong", badgeVariant: "success" });
    expect(service.getPasswordScoreInfo(2)).toEqual({ label: "weak", badgeVariant: "warning" });
    expect(service.getPasswordScoreInfo(0)).toEqual({ label: "veryWeak", badgeVariant: "danger" });
  });

  it("should check if username is not empty", () => {
    expect(service.isUserNameNotEmpty({ login: { username: "user" } } as any)).toBe(true);
    expect(service.isUserNameNotEmpty({ login: { username: "" } } as any)).toBe(false);
  });

  it("should validate cipher correctly", () => {
    expect(service.isValidCipher(mockValidCipher)).toBe(true);

    expect(service.isValidCipher(mockInvalidCipher)).toBe(false);
  });

  it("should audit password leaks", (done) => {
    service.auditPasswordLeaks$(mockExposedCiphers).subscribe((result) => {
      expect(result).toEqual([{ exposedXTimes: 2, cipherId: "cipher-id-1" }]);
      done();
    });
  });
});
