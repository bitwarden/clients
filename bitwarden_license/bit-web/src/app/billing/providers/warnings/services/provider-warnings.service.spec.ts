import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ProviderId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { RequirePaymentMethodDialogComponent } from "@bitwarden/web-vault/app/billing/payment/components";
import { TaxIdWarningTypes } from "@bitwarden/web-vault/app/billing/warnings/types";

import { ProviderWarningsResponse } from "../types/provider-warnings";

import { ProviderWarningsService } from "./provider-warnings.service";

describe("ProviderWarningsService", () => {
  let service: ProviderWarningsService;
  let activatedRoute: MockProxy<ActivatedRoute>;
  let apiService: MockProxy<ApiService>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let router: MockProxy<Router>;
  let syncService: MockProxy<SyncService>;

  const provider = {
    id: "provider-id-123",
    name: "Test Provider",
  } as Provider;

  const formatDate = (date: Date): string =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  beforeEach(() => {
    activatedRoute = mock<ActivatedRoute>();
    apiService = mock<ApiService>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    router = mock<Router>();
    syncService = mock<SyncService>();

    i18nService.t.mockImplementation((key: string, ...args: any[]) => {
      switch (key) {
        case "unpaidInvoices":
          return "Unpaid invoices";
        case "restoreProviderPortalAccessViaPaymentMethod":
          return `To restore access to the provider portal, add a valid payment method. Your subscription will be cancelled on ${args[0]}.`;
        case "unpaidInvoicesForServiceUser":
          return "There are unpaid invoices on this account. Contact your administrator to restore access to the provider portal.";
        case "providerSuspended":
          return `${args[0]} subscription suspended`;
        case "restoreProviderPortalAccessViaCustomerSupport":
          return "To restore access to the provider portal, contact our support team.";
        case "contactSupportShort":
          return "Contact Support";
        default:
          return key;
      }
    });

    TestBed.configureTestingModule({
      providers: [
        ProviderWarningsService,
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: ApiService, useValue: apiService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
        { provide: SyncService, useValue: syncService },
      ],
    });

    service = TestBed.inject(ProviderWarningsService);
  });

  describe("getTaxIdWarning$", () => {
    it("should return null when no tax ID warning exists", (done) => {
      apiService.send.mockResolvedValue({});

      service.getTaxIdWarning$(provider).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
    });

    it("should return tax_id_missing type when tax ID is missing", (done) => {
      const warning = { Type: TaxIdWarningTypes.Missing };
      apiService.send.mockResolvedValue({
        TaxId: warning,
      });

      service.getTaxIdWarning$(provider).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.Missing);
        done();
      });
    });

    it("should return tax_id_pending_verification type when tax ID verification is pending", (done) => {
      const warning = { Type: TaxIdWarningTypes.PendingVerification };
      apiService.send.mockResolvedValue({
        TaxId: warning,
      });

      service.getTaxIdWarning$(provider).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.PendingVerification);
        done();
      });
    });

    it("should return tax_id_failed_verification type when tax ID verification failed", (done) => {
      const warning = { Type: TaxIdWarningTypes.FailedVerification };
      apiService.send.mockResolvedValue({
        TaxId: warning,
      });

      service.getTaxIdWarning$(provider).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.FailedVerification);
        done();
      });
    });

    it("should refresh warning and update taxIdWarningRefreshedSubject when refreshTaxIdWarning is called", (done) => {
      const initialWarning = { Type: TaxIdWarningTypes.Missing };
      const refreshedWarning = { Type: TaxIdWarningTypes.FailedVerification };
      let invocationCount = 0;

      apiService.send
        .mockResolvedValueOnce({
          TaxId: initialWarning,
        })
        .mockResolvedValueOnce({
          TaxId: refreshedWarning,
        });

      const subscription = service.getTaxIdWarning$(provider).subscribe((result) => {
        invocationCount++;

        if (invocationCount === 1) {
          expect(result).toBe(TaxIdWarningTypes.Missing);
        } else if (invocationCount === 2) {
          expect(result).toBe(TaxIdWarningTypes.FailedVerification);
          subscription.unsubscribe();
          done();
        }
      });

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });

    it("should update taxIdWarningRefreshedSubject with warning type when refresh returns a warning", (done) => {
      const refreshedWarning = { Type: TaxIdWarningTypes.Missing };
      let refreshedCount = 0;

      apiService.send.mockResolvedValueOnce({}).mockResolvedValueOnce({
        TaxId: refreshedWarning,
      });

      const taxIdSubscription = service.taxIdWarningRefreshed$.subscribe((refreshedType) => {
        refreshedCount++;
        if (refreshedCount === 2) {
          expect(refreshedType).toBe(TaxIdWarningTypes.Missing);
          taxIdSubscription.unsubscribe();
          done();
        }
      });

      service.getTaxIdWarning$(provider).subscribe();

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });

    it("should update taxIdWarningRefreshedSubject with null when refresh returns no warning", (done) => {
      const initialWarning = { Type: TaxIdWarningTypes.Missing };
      let refreshedCount = 0;

      apiService.send
        .mockResolvedValueOnce({
          TaxId: initialWarning,
        })
        .mockResolvedValueOnce({});

      const taxIdSubscription = service.taxIdWarningRefreshed$.subscribe((refreshedType) => {
        refreshedCount++;
        if (refreshedCount === 2) {
          expect(refreshedType).toBeNull();
          taxIdSubscription.unsubscribe();
          done();
        }
      });

      service.getTaxIdWarning$(provider).subscribe();

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });
  });

  describe("showProviderSuspendedDialog$", () => {
    it("should not show dialog when no suspension warning exists", (done) => {
      apiService.send.mockResolvedValue({});

      service.showProviderSuspendedDialog$(provider).subscribe({
        complete: () => {
          expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it("should show add payment method dialog with cancellation date", (done) => {
      const cancelsAt = new Date(2024, 11, 31);
      apiService.send.mockResolvedValue({
        Suspension: {
          Resolution: "add_payment_method",
          SubscriptionCancelsAt: cancelsAt.toISOString(),
        },
      });

      const mockDialogRef = {
        closed: of({ type: "success" }),
      } as DialogRef<any>;

      jest.spyOn(RequirePaymentMethodDialogComponent, "open").mockReturnValue(mockDialogRef);
      syncService.fullSync.mockResolvedValue(true);
      router.navigate.mockResolvedValue(true);

      service.showProviderSuspendedDialog$(provider).subscribe({
        complete: () => {
          const expectedDate = formatDate(cancelsAt);
          expect(RequirePaymentMethodDialogComponent.open).toHaveBeenCalledWith(dialogService, {
            data: {
              subscriber: {
                type: "provider",
                data: provider,
              },
              callout: {
                type: "danger",
                title: "Unpaid invoices",
                message: `To restore access to the provider portal, add a valid payment method. Your subscription will be cancelled on ${expectedDate}.`,
              },
            },
          });
          expect(syncService.fullSync).toHaveBeenCalledWith(true);
          expect(router.navigate).toHaveBeenCalledWith(["."], {
            relativeTo: activatedRoute,
            onSameUrlNavigation: "reload",
          });
          done();
        },
      });
    });

    it("should show add payment method dialog without cancellation date", (done) => {
      apiService.send.mockResolvedValue({
        Suspension: {
          Resolution: "add_payment_method",
        },
      });

      const mockDialogRef = {
        closed: of({ type: "cancelled" }),
      } as DialogRef<any>;

      jest.spyOn(RequirePaymentMethodDialogComponent, "open").mockReturnValue(mockDialogRef);

      service.showProviderSuspendedDialog$(provider).subscribe({
        complete: () => {
          expect(RequirePaymentMethodDialogComponent.open).toHaveBeenCalledWith(dialogService, {
            data: {
              subscriber: {
                type: "provider",
                data: provider,
              },
              callout: {
                type: "danger",
                title: "Unpaid invoices",
                message:
                  "To restore access to the provider portal, add a valid payment method. Your subscription will be cancelled on undefined.",
              },
            },
          });
          expect(syncService.fullSync).not.toHaveBeenCalled();
          expect(router.navigate).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it("should show contact administrator dialog for contact_administrator resolution", (done) => {
      apiService.send.mockResolvedValue({
        Suspension: {
          Resolution: "contact_administrator",
        },
      });

      dialogService.openSimpleDialog.mockResolvedValue(true);

      service.showProviderSuspendedDialog$(provider).subscribe({
        complete: () => {
          expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
            type: "danger",
            title: "Unpaid invoices",
            content:
              "There are unpaid invoices on this account. Contact your administrator to restore access to the provider portal.",
            disableClose: true,
          });
          done();
        },
      });
    });

    it("should show contact support dialog with action for contact_support resolution", (done) => {
      apiService.send.mockResolvedValue({
        Suspension: {
          Resolution: "contact_support",
        },
      });

      dialogService.openSimpleDialog.mockResolvedValue(true);
      const openSpy = jest.spyOn(window, "open").mockImplementation();

      service.showProviderSuspendedDialog$(provider).subscribe({
        complete: () => {
          const dialogCall = dialogService.openSimpleDialog.mock.calls[0][0];
          expect(dialogCall).toEqual({
            type: "danger",
            title: "Test Provider subscription suspended",
            content: "To restore access to the provider portal, contact our support team.",
            acceptButtonText: "Contact Support",
            cancelButtonText: null,
            acceptAction: expect.any(Function),
          });

          if (dialogCall.acceptAction) {
            void dialogCall.acceptAction().then(() => {
              expect(openSpy).toHaveBeenCalledWith("https://bitwarden.com/contact/", "_blank");
              openSpy.mockRestore();
              done();
            });
          } else {
            fail("acceptAction should be defined");
          }
        },
      });
    });
  });

  describe("fetchWarnings", () => {
    it("should fetch warnings from correct API endpoint", async () => {
      const mockResponse = { TaxId: { Type: TaxIdWarningTypes.Missing } };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await service.fetchWarnings(provider.id as ProviderId);

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/providers/${provider.id}/billing/vnext/warnings`,
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(ProviderWarningsResponse);
      expect(result.taxId?.type).toBe(TaxIdWarningTypes.Missing);
    });

    it("should handle API response with suspension warning", async () => {
      const cancelsAt = new Date(2024, 11, 31);
      const mockResponse = {
        Suspension: {
          Resolution: "add_payment_method",
          SubscriptionCancelsAt: cancelsAt.toISOString(),
        },
      };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await service.fetchWarnings(provider.id as ProviderId);

      expect(result.suspension?.resolution).toBe("add_payment_method");
      expect(result.suspension?.subscriptionCancelsAt).toEqual(cancelsAt);
    });
  });
});
