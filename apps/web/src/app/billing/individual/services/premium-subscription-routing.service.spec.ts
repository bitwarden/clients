import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { SubscriptionPreviewResponse } from "@bitwarden/common/billing/models/response/subscription-preview.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SubscriptionPreviewClient } from "@bitwarden/web-vault/app/billing/clients/subscription-preview.client";

import { PremiumSubscriptionRoutingService } from "./premium-subscription-routing.service";

describe("PremiumSubscriptionRoutingService", () => {
  const previewClient = mock<SubscriptionPreviewClient>();
  const logService = mock<LogService>();

  let sut: PremiumSubscriptionRoutingService;

  beforeEach(() => {
    jest.resetAllMocks();

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);
    const billingState = mock<BillingAccountProfileStateService>();
    billingState.hasPremiumFromAnyOrganization$.mockReturnValue(of(false));
    const platformUtils = mock<PlatformUtilsService>();
    platformUtils.isSelfHost.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: BillingAccountProfileStateService, useValue: billingState },
        { provide: PlatformUtilsService, useValue: platformUtils },
        { provide: LogService, useValue: logService },
        { provide: SubscriptionPreviewClient, useValue: previewClient },
      ],
    });

    sut = TestBed.inject(PremiumSubscriptionRoutingService);
  });

  it("routes to the user subscription page when the account has a subscription", async () => {
    previewClient.getAccountSubscriptionPreview.mockResolvedValue(
      mock<SubscriptionPreviewResponse>(),
    );

    await expect(firstValueFrom(sut.getSubscriptionRoute$())).resolves.toBe(
      "settings/subscription/user-subscription",
    );
  });

  it("routes to the purchase page when the account has no subscription (404)", async () => {
    previewClient.getAccountSubscriptionPreview.mockRejectedValue(new ErrorResponse(null, 404));

    await expect(firstValueFrom(sut.getSubscriptionRoute$())).resolves.toBe(
      "settings/subscription/premium",
    );
    expect(logService.error).not.toHaveBeenCalled();
  });

  it("logs a server error and routes to the purchase page (500)", async () => {
    const error = new ErrorResponse(null, 500);
    previewClient.getAccountSubscriptionPreview.mockRejectedValue(error);

    await expect(firstValueFrom(sut.getSubscriptionRoute$())).resolves.toBe(
      "settings/subscription/premium",
    );
    expect(logService.error).toHaveBeenCalledWith(
      "Failed to fetch subscription for routing",
      error,
    );
  });
});
