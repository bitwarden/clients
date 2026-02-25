import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/common/types/guid";
import { DefaultSendFormConfigService } from "@bitwarden/send-ui";

const userId = "test-user-id" as UserId;

function makePolicies(data: Record<string, boolean>) {
  return [{ type: PolicyType.SendOptions, enabled: true, data }] as any;
}

describe("DefaultSendFormConfigService", () => {
  let service: DefaultSendFormConfigService;
  const mockPolicyService = mock<PolicyService>();
  const mockSendService = mock<SendService>();

  beforeEach(() => {
    mockPolicyService.policiesByType$.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        DefaultSendFormConfigService,
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: SendService, useValue: mockSendService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
      ],
    });

    service = TestBed.inject(DefaultSendFormConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("areSendsAllowed", () => {
    it("is false when all three auth type restrictions are set across policies", async () => {
      mockPolicyService.policiesByType$.mockReturnValue(
        of(
          makePolicies({
            disableNoAuthSends: true,
            disablePasswordSends: true,
            disableEmailVerifiedSends: true,
          }),
        ),
      );

      const config = await service.buildConfig("add", undefined, SendType.Text);

      expect(config.areSendsAllowed).toBe(false);
    });

    it("is true when only two of three auth type restrictions are set", async () => {
      mockPolicyService.policiesByType$.mockReturnValue(
        of(
          makePolicies({
            disableNoAuthSends: true,
            disablePasswordSends: true,
            disableEmailVerifiedSends: false,
          }),
        ),
      );

      const config = await service.buildConfig("add", undefined, SendType.Text);

      expect(config.areSendsAllowed).toBe(true);
    });
  });
});
