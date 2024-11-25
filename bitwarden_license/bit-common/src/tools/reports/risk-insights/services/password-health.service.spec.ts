import { TestBed } from "@angular/core/testing";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { mockCiphers } from "./ciphers.mock";
import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { mockMemberCipherDetails } from "./member-cipher-details-api.service.spec";
import { PasswordHealthService } from "./password-health.service";

describe("PasswordHealthService", () => {
  let service: PasswordHealthService;

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
            getAllFromApiForOrganization: jest.fn().mockResolvedValue(mockCiphers),
          },
        },
        {
          provide: MemberCipherDetailsApiService,
          useValue: {
            getMemberCipherDetails: jest.fn().mockResolvedValue(mockMemberCipherDetails),
          },
        },
      ],
    });

    service = TestBed.inject(PasswordHealthService);
  });

  it("should build the application health report correctly", async () => {
    const result = await service.generateReportDetails("orgId");

    const expected = [
      {
        application: "101domain.com",
        atRiskPasswords: 1,
        totalPasswords: 2,
        atRiskMembers: 2,
        totalMembers: 5,
      },
      {
        application: "123formbuilder.com",
        atRiskPasswords: 1,
        totalPasswords: 1,
        atRiskMembers: 1,
        totalMembers: 1,
      },
      {
        application: "example.com",
        atRiskPasswords: 2,
        totalPasswords: 2,
        atRiskMembers: 5,
        totalMembers: 5,
      },
      {
        application: "google.com",
        atRiskPasswords: 2,
        totalPasswords: 2,
        atRiskMembers: 3,
        totalMembers: 3,
      },
    ];

    const sortFn = (a: any, b: any) => a.application.localeCompare(b.application);

    expect(result.details.sort(sortFn)).toEqual(expected.sort(sortFn));
    expect(result.totalAtRiskMembers).toBe(5);
    expect(result.totalMembers).toBe(6);
    expect(result.totalAtRiskApps).toBe(4);
    expect(result.totalApps).toBe(4);
  });

  describe("getReusedPasswords", () => {
    it.only("should return an array of reused passwords", () => {
      const ciphers = [
        { login: { password: "123" }, type: CipherType.Login, viewPassword: true },
        { login: { password: "123" }, type: CipherType.Login, viewPassword: true },
        { login: { password: "abc" }, type: CipherType.Login, viewPassword: true },
      ] as CipherView[];
      const result = service.getReusedPasswords(ciphers);
      expect(result).toEqual(new Set(["123"]));
    });
  });

  describe("isWeakPassword", () => {
    it("should return true for a weak password", () => {
      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.login = { password: "123", username: "user" } as LoginView;
      cipher.viewPassword = true;

      expect(service.isWeakPassword(cipher)).toBe(true);
    });

    it("should return false for a strong password", () => {
      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.login = { password: "StrongPass!123", username: "user" } as LoginView;
      cipher.viewPassword = true;

      expect(service.isWeakPassword(cipher)).toBe(false);
    });
  });
});
