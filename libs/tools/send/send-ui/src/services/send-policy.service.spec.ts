import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { SendPolicyService } from "@bitwarden/send-ui";

const userId = "test-user-id" as UserId;

function makePolicy(data: Record<string, unknown> | null): Policy {
  const p = new Policy();
  p.data = data;
  p.enabled = true;
  return p;
}

describe("SendPolicyService", () => {
  const policyServiceMock = mock<PolicyService>();
  const configServiceMock = mock<ConfigService>();

  function setup(flagEnabled: boolean): SendPolicyService {
    configServiceMock.getFeatureFlag$.mockReturnValue(of(flagEnabled));
    TestBed.configureTestingModule({
      providers: [
        { provide: PolicyService, useValue: policyServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        SendPolicyService,
      ],
    });
    return TestBed.inject(SendPolicyService);
  }

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("disableSend$", () => {
    describe("when the SendControls flag is enabled", () => {
      it("emits true when SendControls policy has disableSend: true", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableSend: true })]));
        policyServiceMock.policyAppliesToUser$
          .calledWith(PolicyType.DisableSend, userId)
          .mockReturnValue(of(false));

        expect(await firstValueFrom(setup(true).disableSend$)).toBe(true);
      });

      it("emits false when SendControls policy has disableSend: false and no legacy policy", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableSend: false })]));
        policyServiceMock.policyAppliesToUser$
          .calledWith(PolicyType.DisableSend, userId)
          .mockReturnValue(of(false));

        expect(await firstValueFrom(setup(true).disableSend$)).toBe(false);
      });

      it("emits false when policy data is null and no legacy policy", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy(null)]));
        policyServiceMock.policyAppliesToUser$
          .calledWith(PolicyType.DisableSend, userId)
          .mockReturnValue(of(false));

        expect(await firstValueFrom(setup(true).disableSend$)).toBe(false);
      });

      it("emits true when legacy DisableSend applies even if SendControls does not", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([]));
        policyServiceMock.policyAppliesToUser$
          .calledWith(PolicyType.DisableSend, userId)
          .mockReturnValue(of(true));

        expect(await firstValueFrom(setup(true).disableSend$)).toBe(true);
      });
    });

    describe("when the SendControls flag is disabled", () => {
      it("reads from DisableSend rather than SendControls", async () => {
        policyServiceMock.policyAppliesToUser$
          .calledWith(PolicyType.DisableSend, userId)
          .mockReturnValue(of(true));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableSend: false })]));

        expect(await firstValueFrom(setup(false).disableSend$)).toBe(true);
      });
    });
  });

  describe("disableHideEmail$", () => {
    describe("when the SendControls flag is enabled", () => {
      it("emits true when SendControls policy has disableHideEmail: true", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableHideEmail: true })]));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendOptions, userId)
          .mockReturnValue(of([]));

        expect(await firstValueFrom(setup(true).disableHideEmail$)).toBe(true);
      });

      it("emits false when SendControls policy has disableHideEmail: false and no legacy policy", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableHideEmail: false })]));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendOptions, userId)
          .mockReturnValue(of([]));

        expect(await firstValueFrom(setup(true).disableHideEmail$)).toBe(false);
      });

      it("emits false when policy data is null and no legacy policy", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy(null)]));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendOptions, userId)
          .mockReturnValue(of([]));

        expect(await firstValueFrom(setup(true).disableHideEmail$)).toBe(false);
      });

      it("emits true when legacy SendOptions applies even if SendControls does not", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([]));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendOptions, userId)
          .mockReturnValue(of([makePolicy({ disableHideEmail: true })]));

        expect(await firstValueFrom(setup(true).disableHideEmail$)).toBe(true);
      });
    });

    describe("when the SendControls flag is disabled", () => {
      it("reads from SendOptions rather than SendControls", async () => {
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendOptions, userId)
          .mockReturnValue(of([makePolicy({ disableHideEmail: true })]));
        policyServiceMock.policiesByType$
          .calledWith(PolicyType.SendControls, userId)
          .mockReturnValue(of([makePolicy({ disableHideEmail: false })]));

        expect(await firstValueFrom(setup(false).disableHideEmail$)).toBe(true);
      });
    });
  });
});
