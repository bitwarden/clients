import { ChangeDetectionStrategy, Component, forwardRef, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { Cart, CartSummaryComponent } from "@bitwarden/pricing";
import {
  OrganizationRestartPreviewRequest,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  getBillingAddressFromForm,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { BillingAddress } from "@bitwarden/web-vault/app/billing/payment/types";

import { BillingNotificationService } from "../services/billing-notification.service";
import { InvoicePreviewService } from "../services/invoice-preview.service";

import {
  RestartSubscriptionDialogComponent,
  RestartSubscriptionDialogResultType,
} from "./restart-subscription-dialog.component";

const tokenizeMock = jest.fn();

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-payment-method",
  template: "",
  providers: [
    {
      provide: EnterPaymentMethodComponent,
      useExisting: forwardRef(() => StubEnterPaymentMethodComponent),
    },
  ],
})
class StubEnterPaymentMethodComponent {
  readonly group = input<unknown>();
  tokenize = () => tokenizeMock();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-billing-address",
  template: "",
})
class StubEnterBillingAddressComponent {
  readonly group = input<unknown>();
  readonly scenario = input<unknown>();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "billing-cart-summary",
  template: "",
})
class StubCartSummaryComponent {
  readonly cart = input<unknown>();
}

type DialogHarness = {
  fixture: ComponentFixture<RestartSubscriptionDialogComponent>;
  component: RestartSubscriptionDialogComponent;
};

const plan = (overrides: Partial<PlanResponse>): PlanResponse =>
  ({
    type: PlanType.TeamsAnnually,
    productTier: ProductTierType.Teams,
    isAnnual: true,
    disabled: false,
    nameLocalizationKey: "planNameTeams",
    PasswordManager: {},
    ...overrides,
  }) as PlanResponse;

const savedAddress: BillingAddress = {
  country: "DE",
  postalCode: "10115",
  line1: "Unter den Linden 1",
  line2: null,
  city: "Berlin",
  state: null,
  taxId: { code: "eu_vat", value: "DE123456789" },
};

describe("RestartSubscriptionDialogComponent", () => {
  const organization = { id: "org-id" } as Organization;

  let apiService: ReturnType<typeof mock<ApiService>>;
  let subscriberBillingClient: ReturnType<typeof mock<SubscriberBillingClient>>;
  let billingNotificationService: ReturnType<typeof mock<BillingNotificationService>>;
  let invoicePreviewService: ReturnType<typeof mock<InvoicePreviewService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let syncService: ReturnType<typeof mock<SyncService>>;
  let router: ReturnType<typeof mock<Router>>;
  let dialogRef: ReturnType<typeof mock<DialogRef>>;
  let organizationWarningsService: ReturnType<typeof mock<OrganizationWarningsService>>;
  let subscriptionPlan: PlanResponse;
  let availablePlans: PlanResponse[];

  const setup = async (): Promise<DialogHarness> => {
    const subscription = {
      plan: subscriptionPlan,
      subscription: { status: "canceled" },
    } as OrganizationSubscriptionResponse;

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([organization]));
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject({ id: "user-id" } as never);
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    apiService.getPlans.mockResolvedValue({ data: availablePlans } as ListResponse<PlanResponse>);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: { organizationId: "org-id", subscription } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ApiService, useValue: apiService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: SubscriberBillingClient, useValue: subscriberBillingClient },
        { provide: BillingNotificationService, useValue: billingNotificationService },
        { provide: InvoicePreviewService, useValue: invoicePreviewService },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: toastService },
        { provide: SyncService, useValue: syncService },
        { provide: Router, useValue: router },
        { provide: OrganizationWarningsService, useValue: organizationWarningsService },
      ],
    });
    TestBed.overrideComponent(RestartSubscriptionDialogComponent, {
      remove: {
        imports: [EnterPaymentMethodComponent, EnterBillingAddressComponent, CartSummaryComponent],
      },
      add: {
        imports: [
          StubEnterPaymentMethodComponent,
          StubEnterBillingAddressComponent,
          StubCartSummaryComponent,
        ],
      },
    });

    const fixture = TestBed.createComponent(RestartSubscriptionDialogComponent);
    fixture.detectChanges();
    await jest.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  const internals = (harness: DialogHarness) =>
    harness.component as unknown as {
      formGroup: RestartSubscriptionDialogComponent["formGroup"];
      restartPlan: () => PlanResponse | undefined;
      addressLoadFailed: () => boolean;
      addressReady: () => boolean;
      supportsTaxId: () => boolean;
      restartRequest: () => OrganizationRestartPreviewRequest | undefined;
      restartCart: { isLoading(): boolean; hasValue(): boolean; error(): unknown };
      previewErrorMessageKey: () => string;
      restartDisabled: () => boolean;
      submit: () => Promise<void>;
    };

  beforeAll(() => {
    // jsdom does not implement IntersectionObserver, which bit-dialog uses internally.
    global.IntersectionObserver = class {
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    apiService = mock<ApiService>();
    subscriberBillingClient = mock<SubscriberBillingClient>();
    subscriberBillingClient.getBillingAddress.mockResolvedValue(savedAddress);
    billingNotificationService = mock<BillingNotificationService>();
    invoicePreviewService = mock<InvoicePreviewService>();
    toastService = mock<ToastService>();
    syncService = mock<SyncService>();
    router = mock<Router>({ url: "/", events: EMPTY });
    dialogRef = mock<DialogRef>();
    organizationWarningsService = mock<OrganizationWarningsService>();
    tokenizeMock.mockReset();
    tokenizeMock.mockResolvedValue({ type: "card", token: "tok" });
    invoicePreviewService.previewRestartCart.mockResolvedValue({} as Cart);
    subscriptionPlan = plan({});
    availablePlans = [subscriptionPlan];
  });

  describe("billing address prefill", () => {
    it("prefills the billing address, including the tax ID, from the saved address", async () => {
      const dialog = internals(await setup());

      const address = dialog.formGroup.controls.billingAddress.getRawValue();
      expect(address.country).toBe("DE");
      expect(address.postalCode).toBe("10115");
      expect(address.taxId).toBe("DE123456789");
      expect(dialog.addressReady()).toBe(true);
    });

    it("leaves the address blank when no address is saved", async () => {
      subscriberBillingClient.getBillingAddress.mockResolvedValue(null);

      const dialog = internals(await setup());

      const address = dialog.formGroup.controls.billingAddress.getRawValue();
      expect(address.country).toBe("");
      expect(address.postalCode).toBe("");
      expect(dialog.addressLoadFailed()).toBe(false);
      expect(dialog.addressReady()).toBe(true);
    });

    it("flags an address load failure and reports it", async () => {
      const error = new Error("boom");
      subscriberBillingClient.getBillingAddress.mockRejectedValue(error);

      const dialog = internals(await setup());

      expect(dialog.addressLoadFailed()).toBe(true);
      expect(billingNotificationService.handleError).toHaveBeenCalledWith(error);
      expect(dialog.addressReady()).toBe(false);
    });
  });

  describe("restart plan", () => {
    it("resolves the restart plan to the subscription's plan when it is enabled", async () => {
      const dialog = internals(await setup());

      expect(dialog.restartPlan()?.type).toBe(PlanType.TeamsAnnually);
    });

    it("resolves the restart plan to the enabled same-tier, same-cadence plan when the subscription's plan is disabled", async () => {
      subscriptionPlan = plan({ type: PlanType.TeamsAnnually2020, disabled: true });
      availablePlans = [
        subscriptionPlan,
        plan({ type: PlanType.TeamsMonthly, isAnnual: false }),
        plan({ type: PlanType.TeamsAnnually }),
      ];

      const dialog = internals(await setup());

      expect(dialog.restartPlan()?.type).toBe(PlanType.TeamsAnnually);
    });

    it("falls back to the subscription's plan when the disabled plan has no enabled replacement", async () => {
      subscriptionPlan = plan({ type: PlanType.TeamsAnnually2020, disabled: true });
      availablePlans = [subscriptionPlan, plan({ type: PlanType.TeamsMonthly, isAnnual: false })];

      const dialog = internals(await setup());

      expect(dialog.restartPlan()).toBe(subscriptionPlan);
    });

    it("does not support a tax ID for a Families restart plan", async () => {
      subscriptionPlan = plan({
        type: PlanType.FamiliesAnnually,
        productTier: ProductTierType.Families,
      });
      availablePlans = [subscriptionPlan];

      const dialog = internals(await setup());

      expect(dialog.supportsTaxId()).toBe(false);
    });

    it("supports a tax ID for a Teams restart plan", async () => {
      const dialog = internals(await setup());

      expect(dialog.supportsTaxId()).toBe(true);
    });
  });

  describe("cart preview", () => {
    const debounceMs = 1000;

    let fixture: ComponentFixture<RestartSubscriptionDialogComponent>;

    const open = async () => {
      const harness = await setup();
      fixture = harness.fixture;
      return internals(harness);
    };

    const settle = async () => {
      fixture.detectChanges();
      await jest.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
    };

    const expectedRequest = (
      dialog: ReturnType<typeof internals>,
      postalCode: string,
    ): OrganizationRestartPreviewRequest => {
      const { country, taxId } = getBillingAddressFromForm(
        dialog.formGroup.controls.billingAddress,
      );
      return { billingAddress: { country, postalCode, taxId } };
    };

    const editPostalCode = (dialog: ReturnType<typeof internals>, postalCode: string) =>
      dialog.formGroup.controls.billingAddress.controls.postalCode.setValue(postalCode);

    it("previews the prefilled address once it is in the form", async () => {
      const dialog = await open();

      await settle();

      expect(dialog.restartRequest()?.billingAddress.taxId).toEqual({
        code: expect.any(String),
        value: "DE123456789",
      });
      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);
      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledWith(
        "org-id",
        expectedRequest(dialog, "10115"),
      );
    });

    it("does not preview when the saved address failed to load", async () => {
      subscriberBillingClient.getBillingAddress.mockRejectedValue(new Error("boom"));

      const dialog = await open();
      await settle();

      expect(invoicePreviewService.previewRestartCart).not.toHaveBeenCalled();
      expect(dialog.restartDisabled()).toBe(true);
    });

    it("re-previews an edited address after the 1000 ms debounce", async () => {
      const dialog = await open();
      await settle();

      editPostalCode(dialog, "10117");
      await jest.advanceTimersByTimeAsync(debounceMs - 1);
      await settle();
      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await settle();
      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(2);
      expect(invoicePreviewService.previewRestartCart).toHaveBeenLastCalledWith(
        "org-id",
        expectedRequest(dialog, "10117"),
      );
    });

    it("does not re-preview an identical address", async () => {
      const dialog = await open();
      await settle();

      editPostalCode(dialog, "10115");
      await jest.advanceTimersByTimeAsync(debounceMs);
      await settle();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);
    });

    it("does not preview an invalid address and keeps the last request", async () => {
      const dialog = await open();
      await settle();

      editPostalCode(dialog, "");
      await jest.advanceTimersByTimeAsync(debounceMs);
      await settle();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(1);
      expect(dialog.restartRequest()?.billingAddress.postalCode).toBe("10115");
      expect(dialog.restartDisabled()).toBe(true);
    });

    it("disables Restart between an address edit and the matching preview", async () => {
      const dialog = await open();
      await settle();
      expect(dialog.restartDisabled()).toBe(false);

      editPostalCode(dialog, "10117");
      expect(dialog.restartDisabled()).toBe(true);

      await jest.advanceTimersByTimeAsync(debounceMs);
      await settle();
      expect(dialog.restartDisabled()).toBe(false);
    });

    const billingAddressError = () =>
      new ErrorResponse(
        {
          Message: "The model state is invalid.",
          ValidationErrors: { BillingAddress: ["Your location wasn't recognized."] },
        },
        400,
      );

    it("shows the invalid-address message for a 400 keyed to the billing address", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValue(billingAddressError());

      const dialog = await open();
      await settle();

      expect(dialog.previewErrorMessageKey()).toBe("billingPreviewInvalidAddressError");
      expect(billingNotificationService.showError).toHaveBeenCalledWith(
        "billingPreviewInvalidAddressError",
      );
      expect(dialog.restartDisabled()).toBe(true);
    });

    it("shows the generic preview message for a 400 not keyed to the billing address", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValue(
        new ErrorResponse({ Message: "bad request" }, 400),
      );

      const dialog = await open();
      await settle();

      expect(dialog.previewErrorMessageKey()).toBe("invoicePreviewErrorMessage");
      expect(billingNotificationService.showError).toHaveBeenCalledWith(
        "invoicePreviewErrorMessage",
      );
      expect(dialog.restartDisabled()).toBe(true);
    });

    it("shows the generic preview message for a 409 failure", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValue(
        new ErrorResponse({ Message: "conflict" }, 409),
      );

      const dialog = await open();
      await settle();

      expect(dialog.previewErrorMessageKey()).toBe("invoicePreviewErrorMessage");
      expect(billingNotificationService.showError).toHaveBeenCalledWith(
        "invoicePreviewErrorMessage",
      );
      expect(dialog.restartCart.isLoading()).toBe(false);
      expect(dialog.restartDisabled()).toBe(true);
    });

    const retryButton = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector("#restart-subscription-dialog_button_retry-preview");

    it("retries a failed preview with the same address from the try-again link", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValueOnce(
        new ErrorResponse({ Message: "conflict" }, 409),
      );
      const dialog = await open();
      await settle();

      retryButton()!.click();
      await settle();

      expect(invoicePreviewService.previewRestartCart).toHaveBeenCalledTimes(2);
      expect(invoicePreviewService.previewRestartCart).toHaveBeenLastCalledWith(
        "org-id",
        expectedRequest(dialog, "10115"),
      );
      expect(dialog.restartDisabled()).toBe(false);
    });

    it("offers no try-again link for an invalid-address failure", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValue(billingAddressError());
      await open();
      await settle();

      expect(retryButton()).toBeNull();
    });

    it("offers the try-again link for a 400 not keyed to the billing address", async () => {
      invoicePreviewService.previewRestartCart.mockRejectedValue(
        new ErrorResponse({ Message: "bad request" }, 400),
      );
      await open();
      await settle();

      expect(retryButton()).not.toBeNull();
    });
  });

  describe("submit", () => {
    const callOrder = (fn: jest.Mock | jest.MockInstance<unknown, never[]>) =>
      fn.mock.invocationCallOrder[0];

    it("restarts with the tokenized payment method and the form's address, then refreshes, toasts, syncs, navigates and closes", async () => {
      const dialog = internals(await setup());

      await dialog.submit();

      expect(subscriberBillingClient.restartSubscription).toHaveBeenCalledWith(
        { type: "organization", data: organization },
        { type: "card", token: "tok" },
        getBillingAddressFromForm(dialog.formGroup.controls.billingAddress),
      );
      expect(organizationWarningsService.refreshInactiveSubscriptionWarning).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: undefined,
        message: "restartOrganizationSubscription",
      });
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(router.navigate).toHaveBeenCalledWith(["/organizations/org-id/billing/subscription"]);
      expect(dialogRef.close).toHaveBeenCalledWith(RestartSubscriptionDialogResultType.Submitted);

      const sequence = [
        subscriberBillingClient.restartSubscription,
        organizationWarningsService.refreshInactiveSubscriptionWarning,
        toastService.showToast,
        syncService.fullSync,
        router.navigate,
        dialogRef.close,
      ].map((fn) => callOrder(fn as jest.Mock));
      expect(sequence).toEqual([...sequence].sort((a, b) => a - b));
    });

    it("does not restart when the payment method could not be tokenized", async () => {
      tokenizeMock.mockResolvedValue(null);
      const dialog = internals(await setup());

      await dialog.submit();

      expect(subscriberBillingClient.restartSubscription).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("does not toast, sync, navigate or close when restart fails", async () => {
      subscriberBillingClient.restartSubscription.mockRejectedValue(new Error("restart failed"));
      const dialog = internals(await setup());

      await expect(dialog.submit()).rejects.toThrow("restart failed");

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(syncService.fullSync).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
