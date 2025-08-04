import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { ProviderSubscriptionResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogRef, DialogService } from "@bitwarden/components";
import {
  RequirePaymentMethodDialogComponent,
  SubmitPaymentMethodDialogResult,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { ProviderWarningsService } from "./provider-warnings.service";

describe("ProviderWarningsService", () => {
  let service: ProviderWarningsService;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;
  let providerService: MockProxy<ProviderService>;
  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let router: MockProxy<Router>;
  let syncService: MockProxy<SyncService>;

  beforeEach(() => {
    billingApiService = mock<BillingApiServiceAbstraction>();
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    providerService = mock<ProviderService>();
    router = mock<Router>();
    syncService = mock<SyncService>();

    TestBed.configureTestingModule({
      providers: [
        ProviderWarningsService,
        { provide: ActivatedRoute, useValue: {} },
        { provide: BillingApiServiceAbstraction, useValue: billingApiService },
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: ProviderService, useValue: providerService },
        { provide: Router, useValue: router },
        { provide: SyncService, useValue: syncService },
      ],
    });

    service = TestBed.inject(ProviderWarningsService);
  });

  it("should create the service", () => {
    expect(service).toBeTruthy();
  });

  describe("showProviderSuspendedDialog$", () => {
    const providerId = "test-provider-id";

    it("should not show any dialog when the 'pm-21821-provider-portal-takeover' flag is disabled", (done) => {
      const provider = { enabled: false } as Provider;
      const subscription = { status: "unpaid" } as ProviderSubscriptionResponse;

      providerService.get$.mockReturnValue(of(provider));
      billingApiService.getProviderSubscription.mockResolvedValue(subscription);
      configService.getFeatureFlag$.mockReturnValue(of(false));

      const requirePaymentMethodDialogComponentOpenSpy = jest.spyOn(
        RequirePaymentMethodDialogComponent,
        "open",
      );

      service.showProviderSuspendedDialog$(providerId).subscribe(() => {
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(requirePaymentMethodDialogComponentOpenSpy).not.toHaveBeenCalled();
        done();
      });
    });

    it("should not show any dialog when the provider is enabled", (done) => {
      const provider = { enabled: true } as Provider;
      const subscription = { status: "unpaid" } as ProviderSubscriptionResponse;

      providerService.get$.mockReturnValue(of(provider));
      billingApiService.getProviderSubscription.mockResolvedValue(subscription);
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const requirePaymentMethodDialogComponentOpenSpy = jest.spyOn(
        RequirePaymentMethodDialogComponent,
        "open",
      );

      service.showProviderSuspendedDialog$(providerId).subscribe(() => {
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(requirePaymentMethodDialogComponentOpenSpy).not.toHaveBeenCalled();
        done();
      });
    });

    it("should show the require payment method dialog for an admin of a provider with an unpaid subscription", (done) => {
      const provider = {
        enabled: false,
        type: ProviderUserType.ProviderAdmin,
        name: "Test Provider",
      } as Provider;
      const subscription = {
        status: "unpaid",
        cancelAt: "2024-12-31",
      } as ProviderSubscriptionResponse;

      providerService.get$.mockReturnValue(of(provider));
      billingApiService.getProviderSubscription.mockResolvedValue(subscription);
      configService.getFeatureFlag$.mockReturnValue(of(true));

      const dialogRef = {
        closed: of({ type: "success" }),
      } as DialogRef<SubmitPaymentMethodDialogResult>;
      jest.spyOn(RequirePaymentMethodDialogComponent, "open").mockReturnValue(dialogRef);

      service.showProviderSuspendedDialog$(providerId).subscribe(() => {
        expect(RequirePaymentMethodDialogComponent.open).toHaveBeenCalled();
        expect(syncService.fullSync).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalled();
        done();
      });
    });

    it("should show the simple, unpaid invoices dialog for a service user of a provider with an unpaid subscription", (done) => {
      const provider = {
        enabled: false,
        type: ProviderUserType.ServiceUser,
        name: "Test Provider",
      } as Provider;
      const subscription = { status: "unpaid" } as ProviderSubscriptionResponse;

      providerService.get$.mockReturnValue(of(provider));
      billingApiService.getProviderSubscription.mockResolvedValue(subscription);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      configService.getFeatureFlag$.mockReturnValue(of(true));

      i18nService.t.mockImplementation((key: string) => key);

      service.showProviderSuspendedDialog$(providerId).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          type: "danger",
          title: "unpaidInvoices",
          content: "unpaidInvoicesForServiceUser",
          disableClose: true,
        });
        done();
      });
    });

    it("should show the provider suspended dialog to all users of a provider that's suspended, but not unpaid", (done) => {
      const provider = {
        enabled: false,
        name: "Test Provider",
      } as Provider;
      const subscription = { status: "active" } as ProviderSubscriptionResponse;

      providerService.get$.mockReturnValue(of(provider));
      billingApiService.getProviderSubscription.mockResolvedValue(subscription);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      configService.getFeatureFlag$.mockReturnValue(of(true));

      i18nService.t.mockImplementation((key: string) => key);

      service.showProviderSuspendedDialog$(providerId).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          type: "danger",
          title: "providerSuspended",
          content: "restoreProviderPortalAccessViaCustomerSupport",
          disableClose: true,
          acceptButtonText: "contactSupportShort",
          cancelButtonText: null,
          acceptAction: expect.any(Function),
        });
        done();
      });
    });
  });
});
