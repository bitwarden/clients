import { TestBed } from "@angular/core/testing";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { mockCiphers } from "./ciphers.mock";
import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";
import { mockMemberCipherDetails } from "./member-cipher-details-api.service.spec";
import { PasswordHealthService } from "./password-health.service";

// FIXME: Remove password-health report service after PR-15498 completion
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
        { provide: "organizationId", useValue: "org1" },
      ],
    });

    service = TestBed.inject(PasswordHealthService);
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
});
