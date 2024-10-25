import { TestBed } from "@angular/core/testing";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { mockCiphers } from "./ciphers.mock";
import { PasswordHealthService } from "./password-health.service";

describe("PasswordHealthService", () => {
  let service: PasswordHealthService;
  let cipherService: CipherService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PasswordHealthService,
        {
          provide: PasswordStrengthServiceAbstraction,
          useValue: {
            getPasswordStrength: (password: string) => {
              const score = password.length < 4 ? 1 : 4;
              return { score };
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            passwordLeaked: (password: string) => Promise.resolve(password === "123" ? 100 : 0),
          },
        },
        {
          provide: CipherService,
          useValue: {
            getAllFromApiForOrganization: jest.fn().mockResolvedValue(CipherData),
          },
        },
        { provide: "organizationId", useValue: "org1" },
      ],
    });

    service = TestBed.inject(PasswordHealthService);
    cipherService = TestBed.inject(CipherService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should initialize properties", () => {
    expect(service.reportCiphers).toEqual([]);
    expect(service.reportCipherIds).toEqual([]);
    expect(service.passwordStrengthMap.size).toBe(0);
    expect(service.passwordUseMap.size).toBe(0);
    expect(service.exposedPasswordMap.size).toBe(0);
    expect(service.totalMembersMap.size).toBe(0);
  });

  describe("generateReport", () => {
    beforeEach(async () => {
      await service.generateReport();
    });

    it("should fetch all ciphers for the organization", () => {
      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith("org1");
    });

    it("should populate reportCiphers with ciphers that have issues", () => {
      expect(service.reportCiphers.length).toBeGreaterThan(0);
    });

    it("should detect weak passwords", () => {
      expect(service.passwordStrengthMap.size).toBeGreaterThan(0);
      expect(service.passwordStrengthMap.get("cbea34a8-bde4-46ad-9d19-b05001228ab1")).toEqual([
        "veryWeak",
        "danger",
      ]);
      expect(service.passwordStrengthMap.get("cbea34a8-bde4-46ad-9d19-b05001228ab2")).toEqual([
        "veryWeak",
        "danger",
      ]);
      expect(service.passwordStrengthMap.get("cbea34a8-bde4-46ad-9d19-b05001228cd3")).toEqual([
        "veryWeak",
        "danger",
      ]);
    });

    it("should detect reused passwords", () => {
      expect(service.passwordUseMap.get("123")).toBe(3);
    });

    it("should detect exposed passwords", () => {
      expect(service.exposedPasswordMap.size).toBeGreaterThan(0);
      expect(service.exposedPasswordMap.get("cbea34a8-bde4-46ad-9d19-b05001228ab1")).toBe(100);
    });

    it("should calculate total members per cipher", () => {
      expect(service.totalMembersMap.size).toBeGreaterThan(0);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001228ab1")).toBe(3);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001228ab2")).toBe(5);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001228cd3")).toBe(6);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001227nm5")).toBe(4);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001227nm7")).toBe(1);
      expect(service.totalMembersMap.get("cbea34a8-bde4-46ad-9d19-b05001228xy4")).toBe(7);
    });
  });

  describe("findWeakPassword", () => {
    it("should add weak passwords to passwordStrengthMap", () => {
      const weakCipher = mockCiphers.find((c) => c.login?.password === "123") as CipherView;
      service.findWeakPassword(weakCipher);
      expect(service.passwordStrengthMap.get(weakCipher.id)).toEqual(["veryWeak", "danger"]);
    });
  });

  describe("findReusedPassword", () => {
    it("should detect password reuse", () => {
      mockCiphers.forEach((cipher) => {
        service.findReusedPassword(cipher as CipherView);
      });
      const reuseCounts = Array.from(service.passwordUseMap.values()).filter((count) => count > 1);
      expect(reuseCounts.length).toBeGreaterThan(0);
    });
  });

  describe("findExposedPassword", () => {
    it("should add exposed passwords to exposedPasswordMap", async () => {
      const exposedCipher = mockCiphers.find((c) => c.login?.password === "123") as CipherView;
      await service.findExposedPassword(exposedCipher);
      expect(service.exposedPasswordMap.get(exposedCipher.id)).toBe(100);
    });
  });
});
