import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  AdditionalOptionsCardComponent,
  BitwardenSubscription,
  StorageCardComponent,
  SubscriptionCardComponent,
  SubscriptionPreview,
} from "@bitwarden/subscription";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { SubscriptionPreviewService } from "../../services/subscription-preview.service";

import { CloudHostedAccountSubscriptionComponent } from "./cloud-hosted-account-subscription.component";

// Minimal stubs for the billing cards so detectChanges renders the page without pulling their DI.
@Component({
  selector: "billing-subscription-card",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSubscriptionCardComponent {
  readonly title = input<string>();
  readonly subscription = input<unknown>();
  readonly showUpgradeButton = input<boolean>(false);
  readonly callToActionClicked = output<unknown>();
}

@Component({
  selector: "billing-storage-card",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockStorageCardComponent {
  readonly storage = input<unknown>();
  readonly addStorageDisabled = input<boolean>(false);
  readonly removeStorageDisabled = input<boolean>(false);
  readonly callToActionClicked = output<unknown>();
}

@Component({
  selector: "billing-additional-options-card",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockAdditionalOptionsCardComponent {
  readonly downloadLicenseDisabled = input<boolean>(false);
  readonly cancelSubscriptionDisabled = input<boolean>(false);
  readonly callToActionClicked = output<unknown>();
}

describe("CloudHostedAccountSubscriptionComponent", () => {
  let component: CloudHostedAccountSubscriptionComponent;
  let fixture: ComponentFixture<CloudHostedAccountSubscriptionComponent>;
  let accountBillingClient: jest.Mocked<AccountBillingClient>;
  let subscriptionPreviewService: jest.Mocked<SubscriptionPreviewService>;
  let configService: jest.Mocked<ConfigService>;
  let router: jest.Mocked<Router>;

  const legacySubscription = { status: "active" } as BitwardenSubscription;
  const previewSubscription = { status: "active" } as SubscriptionPreview;

  const setPreviewFlag = (enabled: boolean) => {
    configService.getFeatureFlag$.mockImplementation(
      (flag) => of(flag === FeatureFlag.PM36631_PreviewDrivenCart ? enabled : false) as any,
    );
  };

  const createComponent = async () => {
    fixture = TestBed.createComponent(CloudHostedAccountSubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    return component;
  };

  beforeEach(async () => {
    accountBillingClient = mock<AccountBillingClient>();
    accountBillingClient.getSubscription.mockResolvedValue(legacySubscription);

    subscriptionPreviewService = mock<SubscriptionPreviewService>();
    subscriptionPreviewService.getAccountSubscriptionPreview.mockResolvedValue(previewSubscription);

    configService = mock<ConfigService>();
    setPreviewFlag(false);

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    // DialogService (injected by the component) constructs DrawerService, which reads router.url and
    // subscribes to router.events on creation; leaving them unset crashes before the loader runs.
    (router as any).url = "/settings/subscription";
    router.events = new Subject();

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumPersonally$.mockReturnValue(of(true));
    billingAccountProfileStateService.hasPremiumFromAnyOrganization$.mockReturnValue(of(false));

    const subscriptionPricingService = mock<SubscriptionPricingServiceAbstraction>();
    subscriptionPricingService.getPersonalSubscriptionPricingTiers$.mockReturnValue(of([]));

    const i18nService = mock<I18nService>();
    i18nService.t = jest.fn((key: string) => key);

    TestBed.configureTestingModule({
      imports: [CloudHostedAccountSubscriptionComponent],
      providers: [
        { provide: AccountBillingClient, useValue: accountBillingClient },
        { provide: SubscriptionPreviewService, useValue: subscriptionPreviewService },
        { provide: ConfigService, useValue: configService },
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: SubscriptionPricingServiceAbstraction, useValue: subscriptionPricingService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: FileDownloadService, useValue: mock<FileDownloadService>() },
        { provide: ActivatedRoute, useValue: { snapshot: {} } },
      ],
    });

    TestBed.overrideComponent(CloudHostedAccountSubscriptionComponent, {
      remove: {
        imports: [SubscriptionCardComponent, StorageCardComponent, AdditionalOptionsCardComponent],
      },
      add: {
        imports: [
          MockSubscriptionCardComponent,
          MockStorageCardComponent,
          MockAdditionalOptionsCardComponent,
        ],
      },
    });

    await TestBed.compileComponents();
  });

  it("loads the legacy subscription when the preview-driven cart flag is off", async () => {
    setPreviewFlag(false);

    await createComponent();

    expect(accountBillingClient.getSubscription).toHaveBeenCalled();
    expect(subscriptionPreviewService.getAccountSubscriptionPreview).not.toHaveBeenCalled();
    expect(component.subscription.value()).toBe(legacySubscription);
  });

  it("loads the subscription preview when the preview-driven cart flag is on", async () => {
    setPreviewFlag(true);

    await createComponent();

    expect(subscriptionPreviewService.getAccountSubscriptionPreview).toHaveBeenCalled();
    expect(accountBillingClient.getSubscription).not.toHaveBeenCalled();
    expect(component.subscription.value()).toBe(previewSubscription);
  });

  it("redirects when the preview reports no subscription (404)", async () => {
    setPreviewFlag(true);
    subscriptionPreviewService.getAccountSubscriptionPreview.mockRejectedValue(
      new ErrorResponse(null, 404),
    );

    await createComponent();

    expect(component.subscription.value()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(["/settings/subscription/premium"]);
  });

  it("propagates a non-404 preview failure instead of redirecting", async () => {
    setPreviewFlag(true);
    subscriptionPreviewService.getAccountSubscriptionPreview.mockRejectedValue(
      new ErrorResponse(null, 500),
    );

    await createComponent();

    expect(component.subscription.status()).toBe("error");
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
