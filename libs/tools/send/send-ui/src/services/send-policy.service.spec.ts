import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SendPolicyService } from "@bitwarden/send-ui";

describe("SendPolicyService", () => {
  const userId = "user-1" as UserId;
  let policyService: jest.Mocked<PolicyService>;
  let accountService: jest.Mocked<AccountService>;
  let configService: jest.Mocked<ConfigService>;
  let service: SendPolicyService;

  function setup(sendControlsEnabled: boolean) {
    policyService = mock<PolicyService>();
    accountService = mock<AccountService>();
    configService = mock<ConfigService>();
    accountService.activeAccount$ = of({ id: userId } as any);
    configService.getFeatureFlag$.mockImplementation((flag) => {
      if (flag === FeatureFlag.SendControls) {
        return of(sendControlsEnabled);
      }
      return of(false as any);
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SendPolicyService,
        { provide: PolicyService, useValue: policyService },
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: configService },
      ],
    });

    service = TestBed.inject(SendPolicyService);
  }

  describe("disableSend$ — flag OFF", () => {
    beforeEach(() => setup(false));

    it("returns true when DisableSend policy applies to user", (done) => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));

      service.disableSend$.subscribe((value) => {
        expect(value).toBe(true);
        expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
          PolicyType.DisableSend,
          userId,
        );
        done();
      });
    });

    it("returns false when DisableSend policy does not apply to user", (done) => {
      policyService.policyAppliesToUser$.mockReturnValue(of(false));

      service.disableSend$.subscribe((value) => {
        expect(value).toBe(false);
        done();
      });
    });
  });

  describe("disableSend$ — flag ON", () => {
    beforeEach(() => setup(true));

    it("returns true when DisableSend policy is enabled", (done) => {
      const policy = { enabled: true } as Policy;
      policyService.policiesByType$.mockReturnValue(of([policy]));

      service.disableSend$.subscribe((value) => {
        expect(value).toBe(true);
        expect(policyService.policiesByType$).toHaveBeenCalledWith(PolicyType.DisableSend, userId);
        done();
      });
    });

    it("returns false when no DisableSend policies exist", (done) => {
      policyService.policiesByType$.mockReturnValue(of([]));

      service.disableSend$.subscribe((value) => {
        expect(value).toBe(false);
        done();
      });
    });
  });

  describe("disableHideEmail$", () => {
    beforeEach(() => setup(false));

    it("returns true when a SendOptions policy has disableHideEmail set", (done) => {
      const policy = { data: { disableHideEmail: true } } as Policy;
      policyService.policiesByType$.mockReturnValue(of([policy]));

      service.disableHideEmail$.subscribe((value) => {
        expect(value).toBe(true);
        expect(policyService.policiesByType$).toHaveBeenCalledWith(PolicyType.SendOptions, userId);
        done();
      });
    });

    it("returns false when no SendOptions policies exist", (done) => {
      policyService.policiesByType$.mockReturnValue(of([]));

      service.disableHideEmail$.subscribe((value) => {
        expect(value).toBe(false);
        done();
      });
    });

    it("returns false when SendOptions policy does not have disableHideEmail", (done) => {
      const policy = { data: { disableHideEmail: false } } as Policy;
      policyService.policiesByType$.mockReturnValue(of([policy]));

      service.disableHideEmail$.subscribe((value) => {
        expect(value).toBe(false);
        done();
      });
    });
  });
});
