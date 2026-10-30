import { Pipe, PipeTransform } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { Cart, CartSummaryComponent } from "@bitwarden/pricing";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { BillingNotificationService } from "../../services/billing-notification.service";
import { InvoicePreviewService } from "../../services/invoice-preview.service";
import { PlanCardService } from "../../services/plan-card.service";
import { PlanCard } from "../plan-card/plan-card.component";

import { TrialPaymentDialogComponent } from "./trial-payment-dialog.component";

@Pipe({ name: "i18n", standalone: false })
class I18nStubPipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

@Pipe({ name: "vfo1I18n", standalone: false })
class Vfo1I18nStubPipe implements PipeTransform {
  transform(_: string, fallback: string): string {
    return fallback;
  }
}

const ORG_ID = "org-1" as OrganizationId;

const cart = {
  passwordManager: {},
  cadence: "monthly",
  estimatedTax: 4,
} as unknown as Cart;

const planCard = (isAnnual: boolean, productTier: ProductTierType): PlanCard => ({
  title: "plan",
  costPerMember: 4,
  isDisabled: false,
  isAnnual,
  isSelected: !isAnnual,
  productTier,
});

describe("TrialPaymentDialogComponent", () => {
  let fixture: ComponentFixture<TrialPaymentDialogComponent>;
  let invoicePreviewService: ReturnType<typeof mock<InvoicePreviewService>>;
  let billingNotificationService: ReturnType<typeof mock<BillingNotificationService>>;
  let subscriberBillingClient: ReturnType<typeof mock<SubscriberBillingClient>>;
  let planCardService: ReturnType<typeof mock<PlanCardService>>;

  const setup = (
    tier: ProductTierType,
    { isAnnual = false, withAddress = true } = {},
  ): TrialPaymentDialogComponent => {
    const currentPlan = {
      type: PlanType.TeamsMonthly,
      productTier: tier,
      isAnnual,
    } as PlanResponse;
    const subscription = { plan: currentPlan } as OrganizationSubscriptionResponse;
    const organization = Object.assign(new Organization(), { id: ORG_ID, productTierType: tier });

    const apiService = mock<ApiService>();
    apiService.getPlans.mockResolvedValue({
      data: [
        { type: PlanType.TeamsMonthly, productTier: tier, isAnnual: false },
        { type: PlanType.TeamsAnnually, productTier: tier, isAnnual: true },
      ],
    } as any);
    planCardService.getCadenceCards.mockResolvedValue(
      [planCard(false, tier), planCard(true, tier)].map((card) => ({ ...card, discount: 0 })),
    );
    subscriberBillingClient.getBillingAddress.mockResolvedValue(
      withAddress ? ({ country: "US", postalCode: "90210", taxId: null } as any) : null,
    );

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([organization]));
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    TestBed.configureTestingModule({
      declarations: [TrialPaymentDialogComponent, I18nStubPipe, Vfo1I18nStubPipe],
      imports: [CartSummaryComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { organizationId: ORG_ID, subscription, productTierType: tier },
        },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: OrganizationService, useValue: organizationService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: OrganizationApiServiceAbstraction, useValue: mock() },
        { provide: AccountService, useValue: accountService },
        { provide: PlanCardService, useValue: planCardService },
        { provide: ApiService, useValue: apiService },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: OrganizationBillingApiServiceAbstraction,
          useValue: mock<OrganizationBillingApiServiceAbstraction>(),
        },
        { provide: SubscriberBillingClient, useValue: subscriberBillingClient },
        { provide: InvoicePreviewService, useValue: invoicePreviewService },
        { provide: BillingNotificationService, useValue: billingNotificationService },
      ],
      errorOnUnknownElements: false,
      errorOnUnknownProperties: false,
    });

    fixture = TestBed.createComponent(TrialPaymentDialogComponent);
    return fixture.componentInstance;
  };

  // Lets ngOnInit finish, the 500ms address debounce fire, and the resource loader run.
  const settle = () => {
    fixture.detectChanges();
    tick(1000);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  };

  const subscribeButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector("bit-dialog button[type='button']");

  beforeEach(() => {
    invoicePreviewService = mock<InvoicePreviewService>();
    invoicePreviewService.previewPlanChangeCart.mockResolvedValue(cart);
    billingNotificationService = mock<BillingNotificationService>();
    subscriberBillingClient = mock<SubscriberBillingClient>();
    planCardService = mock<PlanCardService>();
  });

  it("requests a plan-change preview for the org's tier and selected cadence", fakeAsync(() => {
    setup(ProductTierType.Teams);

    settle();

    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledTimes(1);
    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledWith(ORG_ID, {
      tier: "teams",
      cadence: "monthly",
      billingAddress: { country: "US", postalCode: "90210", taxId: null },
    });
  }));

  it("requests an annual Families preview", fakeAsync(() => {
    setup(ProductTierType.Families, { isAnnual: true });

    settle();

    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ tier: "families", cadence: "annually" }),
    );
  }));

  it("re-requests when the cadence card changes", fakeAsync(() => {
    const component = setup(ProductTierType.Teams);
    settle();

    void component.setSelected(planCard(true, ProductTierType.Teams));
    settle();

    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledTimes(2);
    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenLastCalledWith(
      ORG_ID,
      expect.objectContaining({ tier: "teams", cadence: "annually" }),
    );
  }));

  it("does not request a preview until country and postal code are set", fakeAsync(() => {
    const component = setup(ProductTierType.Teams, { withAddress: false });
    settle();

    expect(invoicePreviewService.previewPlanChangeCart).not.toHaveBeenCalled();

    component.formGroup.controls.billingAddress.patchValue({
      country: "US",
      postalCode: "90210",
    });
    settle();

    expect(invoicePreviewService.previewPlanChangeCart).toHaveBeenCalledTimes(1);
  }));

  it("disables Subscribe while the preview is loading or failed", fakeAsync(() => {
    invoicePreviewService.previewPlanChangeCart.mockRejectedValue(new Error("boom"));
    setup(ProductTierType.Teams);

    settle();

    expect(subscribeButton().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector("bit-callout[type='danger']")).not.toBeNull();
    expect(billingNotificationService.showError).toHaveBeenCalledWith("invoicePreviewErrorMessage");
  }));

  it("renders billing-cart-summary with the previewed cart", fakeAsync(() => {
    setup(ProductTierType.Teams);

    settle();

    const summary = fixture.debugElement.query(By.directive(CartSummaryComponent));
    expect(summary.componentInstance.cart()).toBe(cart);
    expect(subscribeButton().disabled).toBe(false);
  }));
});
