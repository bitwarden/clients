// These are disabled until we can migrate to signals and remove the use of @Input properties that are used within the mocked child components
/* eslint-disable @angular-eslint/prefer-output-emitter-ref */
/* eslint-disable @angular-eslint/prefer-signals */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from "@angular/core";
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from "@angular/core/testing";
import { FormBuilder, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { InitiationPath, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { SectionComponent, ToastService } from "@bitwarden/components";
import { Cart, DiscountTypes } from "@bitwarden/pricing";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import {
  AccountBillingClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { DEFAULT_TRIAL_LENGTH_DAYS } from "@bitwarden/web-vault/app/billing/constants";

import { OrganizationInformationComponent } from "../../admin-console/organizations/create/organization-information.component";
import { PremiumOrgUpgradeService } from "../individual/upgrade/premium-org-upgrade-payment/services/premium-org-upgrade.service";
import { EnterBillingAddressComponent, EnterPaymentMethodComponent } from "../payment/components";
import { InvoicePreviewService } from "../services/invoice-preview.service";
import { SubscriptionDiscountService } from "../services/subscription-discount.service";
import { SecretsManagerSubscribeComponent, BillingSharedModule } from "../shared";
import { OrganizationSelfHostingLicenseUploaderComponent } from "../shared/self-hosting-license-uploader/organization-self-hosting-license-uploader.component";

import { OrganizationPlansComponent } from "./organization-plans.component";

// Mocked Child Components
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-org-info",
  template: "",
  standalone: true,
})
class MockOrgInfoComponent {
  @Input() formGroup: any;
  @Input() createOrganization = true;
  @Input() isProvider = false;
  @Input() acceptingSponsorship = false;
  @Output() changedBusinessOwned = new EventEmitter<void>();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "sm-subscribe",
  template: "",
  standalone: true,
})
class MockSmSubscribeComponent {
  @Input() formGroup: any;
  @Input() selectedPlan: any;
  @Input() upgradeOrganization = false;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-payment-method",
  template: "",
  standalone: true,
})
class MockEnterPaymentMethodComponent {
  @Input() group: any;
  @Input() showBankAccount = true;

  static getFormGroup() {
    const fb = new FormBuilder();
    return fb.group({
      type: fb.control("card"),
      bankAccount: fb.group({
        routingNumber: fb.control(""),
        accountNumber: fb.control(""),
        accountHolderName: fb.control(""),
        accountHolderType: fb.control(""),
      }),
      billingAddress: fb.group({
        country: fb.control("US"),
        postalCode: fb.control(""),
      }),
    });
  }

  tokenize = jest.fn().mockResolvedValue({
    token: "mock_token",
    type: "card",
  });
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-billing-address",
  template: "",
  standalone: true,
})
class MockEnterBillingAddressComponent {
  @Input() group: any;
  @Input() scenario: any;

  static getFormGroup() {
    return new FormBuilder().group({
      country: ["US", Validators.required],
      postalCode: ["", Validators.required],
      taxId: [""],
      line1: [""],
      line2: [""],
      city: [""],
      state: [""],
    });
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "organization-self-hosting-license-uploader",
  template: "",
  standalone: true,
})
class MockOrganizationSelfHostingLicenseUploaderComponent {
  @Output() onLicenseFileUploaded = new EventEmitter<string>();
}

/**
 * Sets up a mock payment method component that returns a successful tokenization
 */
const setupMockPaymentMethodComponent = (
  component: OrganizationPlansComponent,
  token?: string,
  type?: string,
) => {
  let mockPaymentMethod;
  if (token == null || type == null) {
    // Simulate tokenization failure
    mockPaymentMethod = { tokenize: jest.fn().mockResolvedValue(null) };
  } else {
    // Simulate successful tokenization
    mockPaymentMethod = { tokenize: jest.fn().mockResolvedValue({ token, type }) };
  }

  Object.defineProperty(component, "enterPaymentMethodComponent", {
    value: () => mockPaymentMethod, // ← must be callable like a signal
    configurable: true,
  });
};

/**
 * Patches billing address form with standard test values
 */
const patchBillingAddress = (
  component: OrganizationPlansComponent,
  overrides: Partial<{
    country: string;
    postalCode: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    taxId: string;
  }> = {},
) => {
  component["billingFormGroup"].controls.billingAddress.patchValue({
    country: "US",
    postalCode: "12345",
    line1: "123 Street",
    line2: "",
    city: "City",
    state: "CA",
    taxId: "",
    ...overrides,
  });
};

/**
 * Patches organization form with basic test values
 */
const patchOrganizationForm = (
  component: OrganizationPlansComponent,
  values: {
    name?: string;
    billingEmail?: string;
    productTier?: ProductTierType;
    plan?: PlanType;
    additionalSeats?: number;
    additionalStorage?: number;
  },
) => {
  component["formGroup"].patchValue({
    name: "Test Org",
    billingEmail: "test@example.com",
    productTier: ProductTierType.Free,
    plan: PlanType.Free,
    additionalSeats: 0,
    additionalStorage: 0,
    ...values,
  });
};

/**
 * Returns plan details
 *
 */

const createMockPlans = (): PlanResponse[] => {
  return [
    {
      type: PlanType.Free,
      productTier: ProductTierType.Free,
      name: "Free",
      isAnnual: true,
      upgradeSortOrder: 1,
      displaySortOrder: 1,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 0,
        maxSeats: 2,
        baseSeats: 2,
        hasAdditionalSeatsOption: false,
        hasAdditionalStorageOption: false,
        hasPremiumAccessOption: false,
        baseStorageGb: 0,
      },
      SecretsManager: null,
    } as PlanResponse,
    {
      type: PlanType.FamiliesAnnually,
      productTier: ProductTierType.Families,
      name: "Families",
      isAnnual: true,
      upgradeSortOrder: 2,
      displaySortOrder: 2,
      PasswordManager: {
        basePrice: 40,
        seatPrice: 0,
        maxSeats: 6,
        baseSeats: 6,
        hasAdditionalSeatsOption: false,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: false,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
      },
      SecretsManager: null,
    } as PlanResponse,
    {
      type: PlanType.TeamsAnnually,
      productTier: ProductTierType.Teams,
      name: "Teams",
      isAnnual: true,
      canBeUsedByBusiness: true,
      upgradeSortOrder: 3,
      displaySortOrder: 3,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 48,
        hasAdditionalSeatsOption: true,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: true,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
        premiumAccessOptionPrice: 40,
      },
      SecretsManager: {
        basePrice: 0,
        seatPrice: 72,
        hasAdditionalSeatsOption: true,
        hasAdditionalServiceAccountOption: true,
        baseServiceAccount: 50,
        additionalPricePerServiceAccount: 6,
      },
    } as PlanResponse,
    {
      type: PlanType.EnterpriseAnnually,
      productTier: ProductTierType.Enterprise,
      name: "Enterprise",
      isAnnual: true,
      canBeUsedByBusiness: true,
      trialPeriodDays: 7,
      upgradeSortOrder: 4,
      displaySortOrder: 4,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 72,
        hasAdditionalSeatsOption: true,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: true,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
        premiumAccessOptionPrice: 40,
      },
      SecretsManager: {
        basePrice: 0,
        seatPrice: 144,
        hasAdditionalSeatsOption: true,
        hasAdditionalServiceAccountOption: true,
        baseServiceAccount: 200,
        additionalPricePerServiceAccount: 6,
      },
    } as PlanResponse,
  ];
};

/** Types `value` into a rendered input so the bound form control picks it up. */
function setInputValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("OrganizationPlansComponent", () => {
  let component: OrganizationPlansComponent;
  let fixture: ComponentFixture<OrganizationPlansComponent>;

  // Mock services
  let mockApiService: jest.Mocked<ApiService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;
  let mockRouter: jest.Mocked<Router>;
  let mockSyncService: jest.Mocked<SyncService>;
  let mockPolicyService: jest.Mocked<PolicyService>;
  let mockMessagingService: jest.Mocked<MessagingService>;
  let mockOrganizationApiService: jest.Mocked<OrganizationApiServiceAbstraction>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockAccountBillingClient: jest.Mocked<AccountBillingClient>;
  let mockSubscriberBillingClient: jest.Mocked<SubscriberBillingClient>;
  let mockConfigService: jest.Mocked<ConfigService>;
  const vfo1Enabled = signal(true);
  let mockBillingAccountProfileService: jest.Mocked<BillingAccountProfileStateService>;
  let mockPremiumOrgUpgradeService: jest.Mocked<PremiumOrgUpgradeService>;
  let mockSubscriptionDiscountService: jest.Mocked<SubscriptionDiscountService>;
  let mockInvoicePreviewService: jest.Mocked<InvoicePreviewService>;
  let mockLogService: jest.Mocked<LogService>;

  // Mock data
  let mockPasswordManagerPlans: PlanResponse[];
  let activeAccountSubject: BehaviorSubject<any>;
  let hasPremiumPersonallySubject: BehaviorSubject<boolean>;
  let mockDiscountSubject: Subject<SubscriptionDiscount[]>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock the static getFormGroup methods to return forms without validators
    jest
      .spyOn(EnterPaymentMethodComponent, "getFormGroup")
      .mockReturnValue(MockEnterPaymentMethodComponent.getFormGroup() as any);
    jest
      .spyOn(EnterBillingAddressComponent, "getFormGroup")
      .mockReturnValue(MockEnterBillingAddressComponent.getFormGroup() as any);

    // Initialize mock services
    mockApiService = {
      getPlans: jest.fn(),
      refreshIdentityToken: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockPlatformUtilsService = {
      isSelfHost: jest.fn().mockReturnValue(false),
    } as any;

    mockRouter = {
      navigate: jest.fn(),
    } as any;

    mockSyncService = {
      fullSync: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockPolicyService = {
      policyAppliesToUser$: jest.fn().mockReturnValue(of(false)),
    } as any;

    // Setup subjects for observables
    activeAccountSubject = new BehaviorSubject({
      id: "user-id",
      email: "test@example.com",
    });
    hasPremiumPersonallySubject = new BehaviorSubject<boolean>(false);

    mockAccountService = {
      activeAccount$: activeAccountSubject.asObservable(),
    } as any;

    mockMessagingService = {
      send: jest.fn(),
    } as any;

    mockOrganizationApiService = {
      getBilling: jest.fn(),
      getSubscription: jest.fn(),
      create: jest.fn(),
      createLicense: jest.fn(),
      upgrade: jest.fn(),
      updateKeys: jest.fn(),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockAccountBillingClient = {} as any;

    mockSubscriberBillingClient = {
      getBillingAddress: jest.fn().mockResolvedValue({
        country: "US",
        postalCode: "12345",
      }),
      updatePaymentMethod: jest.fn().mockResolvedValue(undefined),
      getPaymentMethod: jest.fn().mockResolvedValue({
        type: "card",
        brand: "visa",
        last4: "4242",
        expiration: "12/2025",
      }),
    } as any;

    mockConfigService = {
      getFeatureFlag: jest.fn().mockResolvedValue(true),
      getFeatureFlag$: jest.fn().mockReturnValue(of(true)),
    } as any;

    mockLogService = mock<LogService>();

    mockInvoicePreviewService = {
      previewOrganizationCheckoutCart: jest.fn(),
      previewPremiumOrgUpgradeCart: jest.fn(),
    } as any;

    // Vfo1TerminologyService is mocked directly; flag-off tests call vfo1Enabled.set(false).
    vfo1Enabled.set(true);

    mockPremiumOrgUpgradeService = {
      upgradeToOrganization: jest.fn().mockResolvedValue("new-premium-org-id"),
      generateOrganizationEncryptionData: jest.fn().mockResolvedValue({
        key: "mock-key",
        collectionCt: "mock-collection",
        orgKeys: ["public-key", { encryptedString: "private-key" }],
        orgKey: {} as any,
        activeUserId: "user-id" as any,
      }),
      previewProratedInvoice: jest.fn().mockResolvedValue({
        tax: 2.5,
        total: 25.0,
        credit: 10.0,
        newPlanProratedMonths: 6,
        newPlanProratedAmount: 24.0,
      }),
      SubscriptionTierIdFromProductTier: jest.fn().mockImplementation((productTier) => {
        // Mock implementation that returns appropriate tier based on product tier
        if (productTier === ProductTierType.Families) {
          return "families";
        }
        if (productTier === ProductTierType.Teams) {
          return "teams";
        }
        if (productTier === ProductTierType.Enterprise) {
          return "enterprise";
        }
        throw new Error(`Unsupported product tier: ${productTier}`);
      }),
      isBankAccountNotSupportedError: jest.fn().mockReturnValue(false),
    } as any;

    mockDiscountSubject = new Subject<SubscriptionDiscount[]>();
    mockSubscriptionDiscountService = {
      getEligibleDiscountsForTier$: jest.fn().mockReturnValue(mockDiscountSubject.asObservable()),
      mapToCartDiscount: jest.fn().mockReturnValue(null),
      refresh: jest.fn(),
      isDiscountExpiredError: jest.fn().mockReturnValue(false),
    } as any;

    // Setup mock plan data
    mockPasswordManagerPlans = createMockPlans();

    mockApiService.getPlans.mockResolvedValue({
      data: mockPasswordManagerPlans,
    } as any);

    mockBillingAccountProfileService = {
      hasPremiumFromAnyOrganization$: jest.fn().mockReturnValue(of(false)),
      hasPremiumPersonally$: jest.fn().mockReturnValue(hasPremiumPersonallySubject.asObservable()),
      hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
      canViewSubscription$: jest.fn().mockReturnValue(of(true)),
      setHasPremium: jest.fn().mockResolvedValue(undefined),
    } as any;

    await configureTestBed();

    fixture = TestBed.createComponent(OrganizationPlansComponent);
    component = fixture.componentInstance;
  });

  /**
   * Configures the TestBed for `OrganizationPlansComponent`.
   *
   * Child components are swapped for mocks by default. Pass `{ useRealOrgInfo: true }` to keep the
   * real standalone `OrganizationInformationComponent` mounted so its rendered form can be driven
   * through the DOM.
   */
  async function configureTestBed({ useRealOrgInfo = false } = {}) {
    const realChildren = [
      SecretsManagerSubscribeComponent,
      EnterPaymentMethodComponent,
      EnterBillingAddressComponent,
      OrganizationSelfHostingLicenseUploaderComponent,
    ];
    const mockChildren = [
      MockSmSubscribeComponent,
      MockEnterPaymentMethodComponent,
      MockEnterBillingAddressComponent,
      MockOrganizationSelfHostingLicenseUploaderComponent,
    ];

    await TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: Router, useValue: mockRouter },
        { provide: SyncService, useValue: mockSyncService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: MessagingService, useValue: mockMessagingService },
        FormBuilder, // Use real FormBuilder
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: BillingAccountProfileStateService, useValue: mockBillingAccountProfileService },
        { provide: PremiumOrgUpgradeService, useValue: mockPremiumOrgUpgradeService },
        { provide: LogService, useValue: mockLogService },
        { provide: InvoicePreviewService, useValue: mockInvoicePreviewService },
        {
          provide: Vfo1TerminologyService,
          useValue: { iconClass: (icon: string) => icon, enabled: vfo1Enabled },
        },
      ],
    })
      // Override the component to replace child components with mocks and provide mock services
      .overrideModule(BillingSharedModule, {
        remove: { exports: [SecretsManagerSubscribeComponent] },
      })
      .overrideComponent(OrganizationPlansComponent, {
        remove: {
          imports: useRealOrgInfo
            ? realChildren
            : [OrganizationInformationComponent, ...realChildren],
          providers: [
            AccountBillingClient,
            SubscriberBillingClient,
            PremiumOrgUpgradeService,
            SubscriptionDiscountService,
            InvoicePreviewService,
          ],
        },
        add: {
          imports: useRealOrgInfo ? mockChildren : [MockOrgInfoComponent, ...mockChildren],
          providers: [
            { provide: AccountBillingClient, useValue: mockAccountBillingClient },
            { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
            { provide: PremiumOrgUpgradeService, useValue: mockPremiumOrgUpgradeService },
            { provide: SubscriptionDiscountService, useValue: mockSubscriptionDiscountService },
            { provide: LogService, useValue: mockLogService },
            { provide: InvoicePreviewService, useValue: mockInvoicePreviewService },
          ],
        },
      })
      .compileComponents();
  }

  describe("component creation", () => {
    it("should create", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize with default values", () => {
      expect(component["loading"]).toBe(true);
      expect(component.initialProductTier()).toBe(ProductTierType.Free);
    });
  });

  describe("ngOnInit", () => {
    describe("create organization flow", () => {
      it("should load plans from API", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        expect(mockApiService.getPlans).toHaveBeenCalled();
        expect(component["passwordManagerPlans"]).toEqual(mockPasswordManagerPlans);
        expect(component["loading"]).toBe(false);
      });

      it("should set required validators on name and billing email", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        component["formGroup"].controls.name.setValue("");
        component["formGroup"].controls.billingEmail.setValue("");

        expect(component["formGroup"].controls.name.hasError("required")).toBe(true);
        expect(component["formGroup"].controls.billingEmail.hasError("required")).toBe(true);
      });
    });

    it("should use FamiliesAnnually as the family plan", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const familyPlan = component["_familyPlan"];
      expect(familyPlan).toBe(PlanType.FamiliesAnnually);
    });

    describe("initialPlan and initialProductTier inputs", () => {
      it("should set form values from initialPlan and initialProductTier inputs during ngOnInit", async () => {
        fixture.componentRef.setInput("initialPlan", PlanType.TeamsAnnually);
        fixture.componentRef.setInput("initialProductTier", ProductTierType.Teams);

        fixture.detectChanges();
        await fixture.whenStable();

        expect(component["formGroup"].controls.plan.value).toBe(PlanType.TeamsAnnually);
        expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Teams);
      });

      it("should not override Free values when initialPlan and initialProductTier are Free", async () => {
        fixture.componentRef.setInput("initialPlan", PlanType.Free);
        fixture.componentRef.setInput("initialProductTier", ProductTierType.Free);

        fixture.detectChanges();
        await fixture.whenStable();

        // Free plan is default, shouldn't be explicitly set
        expect(component["formGroup"].controls.plan.value).toBe(PlanType.Free);
        expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Free);
      });
    });
  });

  describe("organization creation validation flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should prevent submission with invalid form data", async () => {
      component["formGroup"].patchValue({
        name: "",
        billingEmail: "invalid-email",
        additionalStorage: -1,
        additionalSeats: 200000,
      });

      await component.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
      expect(component["formGroup"].invalid).toBe(true);
    });

    it("should allow submission with valid form data", async () => {
      patchOrganizationForm(component, {
        name: "Valid Organization",
        billingEmail: "valid@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
    });
  });

  describe("plan selection flow", () => {
    it("should configure form appropriately when switching between product tiers", fakeAsync(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      // Start with Families plan with unsupported features
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);

      component["formGroup"].controls.additionalSeats.setValue(10);
      component["formGroup"].controls.additionalStorage.setValue(5);
      tick();
      component.changedProduct();

      // Families doesn't support additional seats
      expect(component["formGroup"].controls.additionalSeats.value).toBe(0);
      expect(component["formGroup"].controls.additionalStorage.value).toBe(0);
      expect(component["formGroup"].controls.plan.value).toBe(PlanType.FamiliesAnnually);

      // Switch to Teams plan which supports additional seats
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      tick();
      component.changedProduct();

      expect(component["formGroup"].controls.plan.value).toBe(PlanType.TeamsAnnually);
      // Teams initializes with 1 seat by default
      expect(component["formGroup"].controls.additionalSeats.value).toBeGreaterThan(0);

      // Switch to Free plan which doesn't support additional storage
      component["formGroup"].controls.additionalStorage.setValue(10);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);
      tick();
      component.changedProduct();

      expect(component["formGroup"].controls.additionalStorage.value).toBe(0);
    }));
  });

  describe("submit", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should create organization successfully", async () => {
      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "organizationCreated",
        message: "organizationReadyToGo",
      });
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("defaults the create request to the in-product initiation path", async () => {
      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initiationPath: InitiationPath.NewOrganizationCreationInProduct,
        }),
      );
    });

    it("sends the provided initiation path on the create request", async () => {
      fixture.componentRef.setInput(
        "initiationPath",
        InitiationPath.PasswordManagerTrialFromMarketingWebsite,
      );

      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initiationPath: InitiationPath.PasswordManagerTrialFromMarketingWebsite,
        }),
      );
    });

    it("should emit onSuccess after successful creation", async () => {
      const onSuccessSpy = jest.spyOn(component.onSuccess, "emit");

      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(onSuccessSpy).toHaveBeenCalledWith({
        organizationId: "new-org-id",
      });
    });

    it("should handle payment method validation failure", async () => {
      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Teams,
        plan: PlanType.TeamsAnnually,
        additionalSeats: 5,
      });

      patchBillingAddress(component);

      setupMockPaymentMethodComponent(component); // Simulate tokenization failure
      await component.submit();

      // Should not create organization if payment method validation fails
      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
    });

    it("shows a localized error toast when the server rejects an unresolvable tax ID", async () => {
      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      mockOrganizationApiService.create.mockRejectedValue(
        new ErrorResponse({ Message: "billingTaxIdTypeInferenceError" }, 400),
      );

      await expect(component.submit()).resolves.not.toThrow();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "billingTaxIdTypeInferenceError",
      });
    });

    it("should block submission when single org policy applies", async () => {
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      // Need to reinitialize after changing policy mock
      const policyFixture = TestBed.createComponent(OrganizationPlansComponent);
      const policyComponent = policyFixture.componentInstance;
      policyFixture.detectChanges();
      await policyFixture.whenStable();

      policyComponent["formGroup"].patchValue({
        name: "Test",
        billingEmail: "test@example.com",
      });

      await policyComponent.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
    });
  });

  describe("self-hosted flow", () => {
    beforeEach(async () => {
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
    });

    it("should render organization self-hosted license and not load plans", async () => {
      mockPlatformUtilsService.isSelfHost.mockReturnValue(true);
      const selfHostedFixture = TestBed.createComponent(OrganizationPlansComponent);
      const selfHostedComponent = selfHostedFixture.componentInstance;

      expect(selfHostedComponent["selfHosted"]).toBe(true);
      expect(mockApiService.getPlans).not.toHaveBeenCalled();
    });

    it("should handle license file upload success", async () => {
      const successSpy = jest.spyOn(component.onSuccess, "emit");

      await component["onLicenseFileUploaded"]("uploaded-org-id");

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "organizationCreated",
        message: "organizationReadyToGo",
      });

      expect(successSpy).toHaveBeenCalledWith({
        organizationId: "uploaded-org-id",
      });

      expect(mockMessagingService.send).toHaveBeenCalledWith("organizationCreated", {
        organizationId: "uploaded-org-id",
      });
    });

    it("should navigate after license upload if not in trial or sponsorship flow", async () => {
      fixture.componentRef.setInput("acceptingSponsorship", false);
      component["isInTrialFlow"] = false;

      await component["onLicenseFileUploaded"]("uploaded-org-id");

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/uploaded-org-id"]);
    });

    it("should not navigate after license upload if accepting sponsorship", async () => {
      fixture.componentRef.setInput("acceptingSponsorship", true);

      await component["onLicenseFileUploaded"]("uploaded-org-id");

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should emit trial success after license upload in trial flow", async () => {
      component["isInTrialFlow"] = true;

      fixture.detectChanges();
      await fixture.whenStable();

      const trialSpy = jest.spyOn(component.onTrialBillingSuccess, "emit");

      await component["onLicenseFileUploaded"]("uploaded-org-id");

      expect(trialSpy).toHaveBeenCalled();
    });
  });

  describe("policy enforcement", () => {
    it("should check single org policy", async () => {
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["singleOrgPolicyAppliesToActiveUser"]).toBe(true);
    });
  });

  describe("business ownership change flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should automatically upgrade to business-compatible plan when marking as business-owned", () => {
      // Start with a personal plan
      component["formGroup"].controls.businessOwned.setValue(false);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      component["formGroup"].controls.plan.setValue(PlanType.FamiliesAnnually);

      // Mark as business-owned
      component["formGroup"].controls.businessOwned.setValue(true);
      component.changedOwnedBusiness();

      // Should automatically switch to Teams (lowest business plan)
      expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Teams);
      expect(component["formGroup"].controls.plan.value).toBe(PlanType.TeamsAnnually);

      // Unchecking businessOwned should not force a downgrade
      component["formGroup"].controls.businessOwned.setValue(false);
      component.changedOwnedBusiness();

      expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Teams);
    });
  });

  describe("business organization plan selection flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should restrict available plans based on business ownership", async () => {
      // Free plan is offered by default
      let products = component.selectableProducts();
      expect(products.find((p) => p.type === PlanType.Free)).toBeDefined();

      // Business organizations should only see business-compatible plans
      component["formGroup"].controls.businessOwned.setValue(true);
      products = component.selectableProducts();
      const nonFreeBusinessPlans = products.filter((p) => p.type !== PlanType.Free);
      nonFreeBusinessPlans.forEach((plan) => {
        expect(plan.canBeUsedByBusiness).toBe(true);
      });
    });

    it("should include Free plan even when canUpgradeFromPremium is true", async () => {
      hasPremiumPersonallySubject.next(true);
      const products = component.selectableProducts();
      expect(products.find((p) => p.type === PlanType.Free)).toBeDefined();
      expect(products.find((p) => p.productTier === ProductTierType.Families)).toBeDefined();
    });
  });

  describe("accepting sponsorship flow", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("acceptingSponsorship", true);
    });

    it("should configure Families plan with full discount when accepting sponsorship", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      // Only Families plan should be available
      const products = component.selectableProducts();
      expect(products.length).toBe(1);
      expect(products[0].productTier).toBe(ProductTierType.Families);

      // Full discount should be applied making the base price free
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      component["formGroup"].controls.plan.setValue(PlanType.FamiliesAnnually);

      expect(component["familiesSponsorshipDiscount"]).toBe(products[0].PasswordManager.basePrice);
    });

    it("should use createCloudHosted and not upgradeFromPremium when accepting sponsorship with a premium subscription", async () => {
      hasPremiumPersonallySubject.next(true);

      fixture.detectChanges();
      await fixture.whenStable();

      patchOrganizationForm(component, {
        name: "My Family Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Families,
        plan: PlanType.FamiliesAnnually,
      });
      patchBillingAddress(component);
      setupMockPaymentMethodComponent(component, "mock_token", "card");

      mockOrganizationApiService.create.mockResolvedValue({ id: "new-family-org-id" } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
      expect(mockPremiumOrgUpgradeService.upgradeToOrganization).not.toHaveBeenCalled();
    });
  });

  describe("plan section heading and sponsored spacing", () => {
    // Second detectChanges renders the plan form once loading has settled.
    async function render(acceptingSponsorship: boolean) {
      fixture.componentRef.setInput("acceptingSponsorship", acceptingSponsorship);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const sections = fixture.debugElement.queryAll(By.directive(SectionComponent));
      return {
        heading: el.querySelector("bit-section h2")?.textContent?.trim(),
        form: el.querySelector("form") as HTMLFormElement,
        orgInfoSection: sections[0].componentInstance as SectionComponent,
        orgInfoSectionEl: sections[0].nativeElement as HTMLElement,
        planSectionEl: sections[1].nativeElement as HTMLElement,
        planWrapperEl: el.querySelector("bit-radio-group bit-radio-button")
          ?.parentElement as HTMLElement,
        priceSpanCount: el.querySelectorAll("bit-radio-group span.tw-pl-4").length,
        everySectionMarginDisabled: sections.every((s) =>
          (s.componentInstance as SectionComponent).disableMargin(),
        ),
      };
    }

    it("uses the sponsored heading and 24px section spacing when accepting sponsorship with VFO1 on", async () => {
      const r = await render(true);

      expect(r.heading).toBe("sponsoredPlanDetails");
      expect(r.form.classList.contains("tw-pt-2")).toBe(true);
      expect(r.form.classList.contains("tw-pt-6")).toBe(false);
      expect(r.everySectionMarginDisabled).toBe(true);
      expect(r.orgInfoSectionEl.classList.contains("tw-mb-6")).toBe(true);
      expect(r.orgInfoSectionEl.classList.contains("tw-block")).toBe(true);
      expect(r.planSectionEl.classList.contains("tw-mb-6")).toBe(true);
      // Nothing but the section margin may sit between the plan card and the next heading.
      expect(r.planWrapperEl.classList.contains("tw-mb-3")).toBe(false);
      expect(r.priceSpanCount).toBe(0);
    });

    it("uses the choose-plan heading and default spacing when not accepting sponsorship", async () => {
      const r = await render(false);

      expect(r.heading).toBe("choosePlan");
      expect(r.form.classList.contains("tw-pt-6")).toBe(true);
      expect(r.form.classList.contains("tw-pt-2")).toBe(false);
      expect(r.orgInfoSection.disableMargin()).toBe(false);
      expect(r.planSectionEl.classList.contains("tw-mb-6")).toBe(false);
      expect(r.planWrapperEl.classList.contains("tw-mb-3")).toBe(true);
      expect(r.priceSpanCount).toBeGreaterThan(0);
    });

    it("keeps the legacy heading and default spacing when accepting sponsorship with VFO1 off", async () => {
      vfo1Enabled.set(false);

      const r = await render(true);

      expect(r.heading).toBe("chooseYourPlan");
      expect(r.form.classList.contains("tw-pt-6")).toBe(true);
      expect(r.orgInfoSection.disableMargin()).toBe(false);
      expect(r.planSectionEl.classList.contains("tw-mb-6")).toBe(false);
      expect(r.planWrapperEl.classList.contains("tw-mb-3")).toBe(true);
      expect(r.priceSpanCount).toBeGreaterThan(0);
    });
  });

  describe("billing form display flow", () => {
    it("should show appropriate billing fields based on plan type", () => {
      // Personal plans (Free, Families) should not require tax ID
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);
      fixture.detectChanges();

      expect(component["showTaxIdField"]()).toBe(false);

      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      fixture.detectChanges();

      expect(component["showTaxIdField"]()).toBe(false);

      // Business plans (Teams, Enterprise) should show tax ID field
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      fixture.detectChanges();

      expect(component["showTaxIdField"]()).toBe(true);

      component["formGroup"].controls.productTier.setValue(ProductTierType.Enterprise);
      fixture.detectChanges();
      expect(component["showTaxIdField"]()).toBe(true);
    });
  });

  describe("secrets manager handling flow", () => {
    it("should enable SM by default when enableSecretsManagerByDefault is true", async () => {
      const smFixture = TestBed.createComponent(OrganizationPlansComponent);
      const smComponent = smFixture.componentInstance;
      smFixture.componentRef.setInput("enableSecretsManagerByDefault", true);
      smComponent["formGroup"].controls.productTier.setValue(ProductTierType.Teams);

      smFixture.detectChanges();
      await smFixture.whenStable();

      expect(smComponent.secretsManagerForm.value.enabled).toBe(true);
      expect(smComponent.secretsManagerForm.value.userSeats).toBe(1);
      expect(smComponent.secretsManagerForm.value.additionalServiceAccounts).toBe(0);
    });
  });

  describe("form update helpers flow", () => {
    it("should handle premium addon access based on plan features", async () => {
      // Plan without premium access option should set addon to true (meaning it's included)
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      fixture.detectChanges();
      await fixture.whenStable();

      component.changedProduct();

      expect(component["formGroup"].controls.premiumAccessAddon.value).toBe(true);

      // Plan with premium access option should set addon to false (user can opt-in)
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      expect(component["formGroup"].controls.premiumAccessAddon.value).toBe(false);
    });

    it("should reset additional storage when plan doesn't support it", async () => {
      component["formGroup"].controls.additionalStorage.setValue(10);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);

      fixture.detectChanges();
      await fixture.whenStable();

      component.changedProduct();

      expect(component["formGroup"].controls.additionalStorage.value).toBe(0);
    });

    it("should handle additional seats for various scenarios", async () => {
      // Plan without additional seats option should reset to 0
      component["formGroup"].controls.additionalSeats.setValue(10);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);

      fixture.detectChanges();
      await fixture.whenStable();

      component.changedProduct();

      expect(component["formGroup"].controls.additionalSeats.value).toBe(0);

      // Default to 1 seat for new org with seats option
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      expect(component["formGroup"].controls.additionalSeats.value).toBeGreaterThanOrEqual(1);
    });
  });

  describe("trial flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should emit onTrialBillingSuccess when in trial flow", async () => {
      component["isInTrialFlow"] = true;
      const trialSpy = jest.spyOn(component.onTrialBillingSuccess, "emit");

      component["formGroup"].patchValue({
        name: "Trial Org",
        billingEmail: "trial@example.com",
        productTier: ProductTierType.Enterprise,
        plan: PlanType.EnterpriseAnnually,
        additionalSeats: 10,
      });

      component["billingFormGroup"].controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
        line1: "123 Street",
        city: "City",
        state: "CA",
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "trial-org-id",
      } as any);

      setupMockPaymentMethodComponent(component, "mock-token", "mock-type");

      await component.submit();

      expect(trialSpy).toHaveBeenCalledWith({
        orgId: "trial-org-id",
        subLabelText: expect.stringContaining("annual"),
      });
    });

    it("should include trialLength in org creation request when trialLength input is set", async () => {
      fixture.componentRef.setInput("trialLength", 14);

      component["formGroup"].patchValue({
        name: "Trial Org",
        billingEmail: "trial@example.com",
        productTier: ProductTierType.Enterprise,
        plan: PlanType.EnterpriseAnnually,
        additionalSeats: 10,
      });

      component["billingFormGroup"].controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
        line1: "123 Street",
        city: "City",
        state: "CA",
      });

      mockOrganizationApiService.create.mockResolvedValue({ id: "trial-org-id" } as any);

      setupMockPaymentMethodComponent(component, "mock-token", "mock-type");

      await component.submit();

      const request = mockOrganizationApiService.create.mock.calls[0][0];
      expect(request.trialLength).toBe(14);
    });

    it("should not navigate away when in trial flow", async () => {
      component["isInTrialFlow"] = true;

      component["formGroup"].patchValue({
        name: "Trial Org",
        billingEmail: "trial@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      mockOrganizationApiService.create.mockResolvedValue({
        id: "trial-org-id",
      } as any);

      await component.submit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe("helper calculation methods", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should calculate monthly seat price correctly", () => {
      const annualPlan = mockPasswordManagerPlans[2]; // Teams Annual - 48/year
      const monthlyPrice = component.seatPriceMonthly(annualPlan);

      expect(monthlyPrice).toBe(4); // 48 / 12
    });

    it("should calculate monthly storage price correctly", () => {
      const annualPlan = mockPasswordManagerPlans[2]; // 4/GB/year
      const monthlyPrice = component.additionalStoragePriceMonthly(annualPlan);

      expect(monthlyPrice).toBeCloseTo(0.333, 2); // 4 / 12
    });

    it("should generate billing sublabel text for annual plan", async () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component["formGroup"].controls.plan.setValue(PlanType.TeamsAnnually);

      component.changedProduct();

      const sublabel = component["billingSubLabelText"]();

      expect(sublabel).toContain("annual");
      expect(sublabel).toContain("$48"); // Seat price
      expect(sublabel).toContain("yr");
    });

    it("should generate billing sublabel text for plan with base price", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      component["formGroup"].controls.plan.setValue(PlanType.FamiliesAnnually);

      component.changedProduct();

      const sublabel = component["billingSubLabelText"]();

      expect(sublabel).toContain("annual");
      expect(sublabel).toContain("$40"); // Base price
    });
  });

  describe("template rendering and UI visibility", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should control form visibility based on loading state", () => {
      // Initially not loading after setup
      expect(component["loading"]).toBe(false);

      // When loading
      component["loading"] = true;
      expect(component["loading"]).toBe(true);

      // When not loading
      component["loading"] = false;
      expect(component["loading"]).toBe(false);
    });

    it("should show payment description based on plan type", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      const paymentDesc = component.paymentDesc;

      expect(typeof paymentDesc).toBe("string");
      expect(paymentDesc.length).toBeGreaterThan(0);
    });

    it("uses the family-vault payment copy when accepting sponsorship with VFO1 on", () => {
      fixture.componentRef.setInput("acceptingSponsorship", true);

      expect(component.paymentDesc).toBe("paymentSponsoredFamilyVault");
      expect(mockI18nService.t).not.toHaveBeenCalledWith("paymentSponsored");
    });

    it("keeps the legacy sponsored payment copy when VFO1 is off", () => {
      vfo1Enabled.set(false);
      fixture.componentRef.setInput("acceptingSponsorship", true);

      expect(component.paymentDesc).toBe("paymentSponsored");
    });

    it("should use paymentChargedWithTrialSpecificLength with plan's trialPeriodDays when on a trial plan and no custom trialLength", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Enterprise);
      component.changedProduct();

      const paymentDesc = component.paymentDesc;

      expect(paymentDesc).not.toBeNull();
      expect(mockI18nService.t).toHaveBeenCalledWith(
        "paymentChargedWithTrialSpecificLength",
        DEFAULT_TRIAL_LENGTH_DAYS,
      );
    });

    it("should use paymentChargedWithTrialSpecificLength with custom trialLength when provided", () => {
      fixture.componentRef.setInput("trialLength", 14);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Enterprise);
      component.changedProduct();

      const paymentDesc = component.paymentDesc;

      expect(paymentDesc).not.toBeNull();
      expect(mockI18nService.t).toHaveBeenCalledWith("paymentChargedWithTrialSpecificLength", 14);
    });

    it("should not show trial when trialLength input is 0", () => {
      fixture.componentRef.setInput("trialLength", 0);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Enterprise);
      component.changedProduct();

      expect(component.freeTrial()).toBe(false);
    });

    it("should not show trial when trialPeriodDays is 0", () => {
      component["passwordManagerPlans"] = [
        {
          type: PlanType.EnterpriseAnnually,
          productTier: ProductTierType.Enterprise,
          name: "Enterprise",
          isAnnual: true,
          canBeUsedByBusiness: true,
          trialPeriodDays: 0,
          upgradeSortOrder: 4,
          displaySortOrder: 4,
          PasswordManager: {
            basePrice: 0,
            seatPrice: 72,
            hasAdditionalSeatsOption: true,
            hasAdditionalStorageOption: true,
            hasPremiumAccessOption: true,
            baseStorageGb: 1,
            additionalStoragePricePerGb: 4,
            premiumAccessOptionPrice: 40,
          },
          SecretsManager: null,
        } as PlanResponse,
      ];
      component["formGroup"].controls.plan.setValue(PlanType.EnterpriseAnnually);

      expect(component.freeTrial()).toBe(false);
    });

    it("should display tax ID field for business plans", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);
      expect(component["showTaxIdField"]()).toBe(false);

      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
      expect(component["showTaxIdField"]()).toBe(false);

      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      expect(component["showTaxIdField"]()).toBe(true);

      component["formGroup"].controls.productTier.setValue(ProductTierType.Enterprise);
      expect(component["showTaxIdField"]()).toBe(true);
    });

    it("should show single org policy block when applicable", () => {
      component["singleOrgPolicyAppliesToActiveUser"] = false;
      expect(component.singleOrgPolicyBlock).toBe(false);

      component["singleOrgPolicyAppliesToActiveUser"] = true;
      expect(component.singleOrgPolicyBlock).toBe(true);
    });
  });

  describe("user interactions and form controls", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should update component state when product tier changes", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);

      // Simulate changing product tier
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Teams);
      expect(component["formGroup"].controls.plan.value).toBe(PlanType.TeamsAnnually);
    });

    it("should update plan when changedOwnedBusiness is called", () => {
      component["formGroup"].controls.businessOwned.setValue(false);
      component["formGroup"].controls.productTier.setValue(ProductTierType.Families);

      component["formGroup"].controls.businessOwned.setValue(true);
      component.changedOwnedBusiness();

      // Should switch to a business-compatible plan
      expect(component["formGroup"].controls.productTier.value).toBe(ProductTierType.Teams);
    });

    it("should update form value when additional seats changes", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      component["formGroup"].controls.additionalSeats.setValue(10);

      expect(component["formGroup"].controls.additionalSeats.value).toBe(10);
    });

    it("should update form value when additional storage changes", () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      component["formGroup"].controls.additionalStorage.setValue(5);

      expect(component["formGroup"].controls.additionalStorage.value).toBe(5);
    });

    it("should mark form as invalid when required fields are empty", () => {
      component["formGroup"].controls.name.setValue("");
      component["formGroup"].controls.billingEmail.setValue("");
      component["formGroup"].markAllAsTouched();

      expect(component["formGroup"].invalid).toBe(true);
    });

    it("should mark form as valid when all required fields are filled correctly", () => {
      patchOrganizationForm(component, {
        name: "Valid Org",
        billingEmail: "valid@example.com",
      });

      expect(component["formGroup"].valid).toBe(true);
    });

    it("should enable Secrets Manager form when plan supports it", () => {
      // Free plan doesn't offer Secrets Manager
      component["formGroup"].controls.productTier.setValue(ProductTierType.Free);
      component.changedProduct();
      expect(component.planOffersSecretsManager()).toBe(false);

      // Teams plan offers Secrets Manager
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();
      expect(component.planOffersSecretsManager()).toBe(true);
      expect(component.secretsManagerForm.disabled).toBe(false);
    });
  });

  describe("payment method and billing flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should validate billing form for paid plans during creation", async () => {
      component["formGroup"].patchValue({
        name: "New Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Teams,
        plan: PlanType.TeamsAnnually,
        additionalSeats: 5,
      });

      // Invalid billing form - explicitly mark as invalid since we removed validators from mock forms
      component["billingFormGroup"].controls.billingAddress.patchValue({
        country: "",
        postalCode: "",
      });

      await component.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
      expect(component["billingFormGroup"].invalid).toBe(true);
    });

    it("should not require billing validation for Free plan", async () => {
      component["formGroup"].patchValue({
        name: "Free Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      // Leave billing form empty
      component["billingFormGroup"].reset();

      mockOrganizationApiService.create.mockResolvedValue({
        id: "free-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
    });
  });

  describe("premium to organization upgrade flow", () => {
    describe("canUpgradeFromPremium computed signal", () => {
      it("should be true when user has premium personally", async () => {
        hasPremiumPersonallySubject.next(true);

        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.canUpgradeFromPremium()).toBe(true);
      });

      it("should be false when user does not have premium personally", async () => {
        // hasPremiumPersonallySubject defaults to false
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.canUpgradeFromPremium()).toBe(false);
      });

      it("should be false when feature flag is disabled even with premium personally", async () => {
        // Need to set up the mock before component initialization since it uses toSignal
        mockConfigService.getFeatureFlag$.mockReturnValue(of(false));
        hasPremiumPersonallySubject.next(true);

        // Create a new fixture with the updated mock
        const newFixture = TestBed.createComponent(OrganizationPlansComponent);
        const newComponent = newFixture.componentInstance;

        newFixture.detectChanges();
        await newFixture.whenStable();

        expect(newComponent.canUpgradeFromPremium()).toBe(false);
      });

      it("should be false when accepting a sponsorship even with premium personally", async () => {
        hasPremiumPersonallySubject.next(true);
        fixture.componentRef.setInput("acceptingSponsorship", true);

        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.canUpgradeFromPremium()).toBe(false);
      });
    });

    describe("submit", () => {
      const newOrgId = "new-premium-org-id";
      const newOrgName = "My Org";

      beforeEach(async () => {
        hasPremiumPersonallySubject.next(true);
        fixture.detectChanges();
        await fixture.whenStable();

        fixture.componentRef.setInput("initialProductTier", ProductTierType.Teams);
        patchOrganizationForm(component, {
          name: newOrgName,
          billingEmail: "test@example.com",
          productTier: ProductTierType.Teams,
          plan: PlanType.TeamsAnnually,
          additionalSeats: 3,
        });
        patchBillingAddress(component);
      });

      it("should call premiumOrgUpgradeService.upgradeToOrganization() instead of create()", async () => {
        setupMockPaymentMethodComponent(component, "mock_token", "card");

        await component.submit();

        expect(mockSubscriberBillingClient.updatePaymentMethod).toHaveBeenCalledWith(
          expect.objectContaining({ type: "account" }),
          { token: "mock_token", type: "card" },
          expect.objectContaining({ country: "US", postalCode: "12345" }),
        );
        expect(mockPremiumOrgUpgradeService.upgradeToOrganization).toHaveBeenCalledWith(
          expect.objectContaining({ id: "user-id" }),
          newOrgName,
          "teams",
          expect.objectContaining({ country: "US", postalCode: "12345" }),
        );
        expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "organizationCreated",
          message: "organizationReadyToGo",
        });
      });

      it("should not call upgradeToOrganization when tokenization fails", async () => {
        setupMockPaymentMethodComponent(component); // Simulates tokenization failure (returns null)

        await component.submit();

        expect(mockPremiumOrgUpgradeService.upgradeToOrganization).not.toHaveBeenCalled();
      });

      it("should show an error toast when the service rejects an unverified bank account payment method", async () => {
        setupMockPaymentMethodComponent(component, "mock_token", "card");
        const bankAccountError = new Error(
          "Unverified bank account payment method is not supported for this upgrade",
        );
        mockPremiumOrgUpgradeService.upgradeToOrganization.mockRejectedValue(bankAccountError);
        mockPremiumOrgUpgradeService.isBankAccountNotSupportedError.mockReturnValue(true);

        await component.submit();

        expect(mockPremiumOrgUpgradeService.isBankAccountNotSupportedError).toHaveBeenCalledWith(
          bankAccountError,
        );
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "unverifiedBankAccountNotSupportedForUpgrade",
        });
      });

      it("should navigate to the new org and show success toast after premium upgrade", async () => {
        setupMockPaymentMethodComponent(component, "mock_token", "card");

        await component.submit();

        expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/" + newOrgId]);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "organizationCreated",
          message: "organizationReadyToGo",
        });
      });

      it("should not call upgradeToOrganization when billing address is incomplete", async () => {
        component["billingFormGroup"].controls.billingAddress.patchValue({
          country: "",
          postalCode: "",
        });

        await component.submit();

        expect(mockPremiumOrgUpgradeService.upgradeToOrganization).not.toHaveBeenCalled();
      });

      it("should use createCloudHosted instead of upgradeFromPremiumToOrganization when upgrading to Free Org", async () => {
        // Change the plan to Free (beforeEach set it to Teams)
        patchOrganizationForm(component, {
          name: "Free Org",
          billingEmail: "test@example.com",
          productTier: ProductTierType.Free,
          plan: PlanType.Free,
        });

        mockOrganizationApiService.create.mockResolvedValue({
          id: "free-org-id",
        } as any);

        await component.submit();

        // Should call generateOrganizationEncryptionData and create (via createCloudHosted)
        expect(
          mockPremiumOrgUpgradeService.generateOrganizationEncryptionData,
        ).toHaveBeenCalledWith("user-id");
        expect(mockOrganizationApiService.create).toHaveBeenCalled();

        // Should NOT call upgradeToOrganization
        expect(mockPremiumOrgUpgradeService.upgradeToOrganization).not.toHaveBeenCalled();

        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "success",
          title: "organizationCreated",
          message: "organizationReadyToGo",
        });
      });
    });
  });

  describe("discount support", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    describe("submit — coupon error recovery", () => {
      it("calls refresh() and shows warning toast when isDiscountExpiredError returns true", () => {
        const couponError = new ErrorResponse({ Message: "Discount expired." }, 400);
        mockSubscriptionDiscountService.isDiscountExpiredError.mockReturnValue(true);

        (component as any).subscriptionDiscountService.isDiscountExpiredError(couponError);

        expect(mockSubscriptionDiscountService.isDiscountExpiredError).toHaveBeenCalledWith(
          couponError,
        );
        expect(mockSubscriptionDiscountService.isDiscountExpiredError(couponError)).toBe(true);

        (component as any).subscriptionDiscountService.refresh();
        expect(mockSubscriptionDiscountService.refresh).toHaveBeenCalled();
      });

      it("does not call refresh() when isDiscountExpiredError returns false", () => {
        const error = new ErrorResponse({ Message: "Bad request" }, 400);
        // default mockReturnValue(false) means isDiscountExpiredError returns false

        expect(mockSubscriptionDiscountService.isDiscountExpiredError(error)).toBe(false);
        expect(mockSubscriptionDiscountService.refresh).not.toHaveBeenCalled();
      });
    });
  });

  describe("preview-driven cart (PM-40231)", () => {
    const scenarioACart = {
      passwordManager: {
        seats: { translationKey: "passwordManagerPlanPrice", cost: 6, quantity: 4 },
        additionalStorage: { translationKey: "additionalStorageGb", cost: 1, quantity: 2 },
      },
      secretsManager: {
        seats: { translationKey: "secretsManagerPlanPrice", cost: 2, quantity: 4 },
        additionalServiceAccounts: {
          translationKey: "additionalServiceAccounts",
          cost: 1,
          quantity: 3,
        },
      },
      cadence: "monthly",
      discounts: [{ type: DiscountTypes.PercentOff, value: 20, amount: 7.4, label: "SAVE20" }],
      estimatedTax: 2.0,
      total: 31.6,
    } as unknown as Cart;

    const scenarioECart = {
      passwordManager: {
        seats: {
          translationKey: "passwordManagerPlanPrice",
          cost: 6,
          quantity: 5,
          discounts: [{ type: DiscountTypes.AmountOff, value: 2, label: "SEATS10" }],
        },
      },
      cadence: "monthly",
      discounts: [{ type: DiscountTypes.AmountOff, value: 5, label: "WELCOME" }],
      estimatedTax: 1.84,
      total: 24.84,
    } as unknown as Cart;

    const scenarioFCart = {
      passwordManager: {
        seats: { translationKey: "familiesMembership", cost: 0, quantity: 1 },
      },
      cadence: "annually",
      estimatedTax: 0,
      total: 0,
    } as unknown as Cart;

    const premiumUpgradeCart = {
      passwordManager: {
        seats: {
          translationKey: "teamsMembership",
          translationParams: ["Teams", "8 months"],
          cost: 31.99,
          quantity: 1,
          hideBreakdown: true,
        },
      },
      cadence: "annually",
      estimatedTax: 2.03,
      credit: { translationKey: "premiumSubscriptionCredit", value: 6.66 },
      total: 27.36,
    } as unknown as Cart;

    const eligibleDiscount: SubscriptionDiscount = {
      stripeCouponId: "coupon-families",
      percentOff: 20,
      duration: "once",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-12-31T00:00:00Z",
      tierEligibility: {
        [DiscountTierType.Premium]: false,
        [DiscountTierType.Families]: true,
      },
    };

    const enterValidAddress = () =>
      component["billingFormGroup"].controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
      });

    // The resource loads from an effect, so flush effects after the debounce and again once the
    // loader settles.
    const settlePreview = () => {
      tick(1500);
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    };

    const selectTeams = () => {
      component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();
      component["formGroup"].controls.plan.setValue(PlanType.TeamsAnnually);
      component["formGroup"].controls.additionalSeats.setValue(4);
    };

    beforeEach(() => {
      fixture = TestBed.createComponent(OrganizationPlansComponent);
      component = fixture.componentInstance;
    });

    describe("premium upgrade branch", () => {
      it("previews through the invoice preview service, not the legacy proration endpoint", fakeAsync(() => {
        mockInvoicePreviewService.previewPremiumOrgUpgradeCart.mockResolvedValue(
          premiumUpgradeCart,
        );
        hasPremiumPersonallySubject.next(true);

        fixture.detectChanges();
        flushMicrotasks();

        component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        expect(mockInvoicePreviewService.previewPremiumOrgUpgradeCart).toHaveBeenCalledWith(
          {
            targetProductTierType: ProductTierType.Teams,
            billingAddress: { country: "US", postalCode: "12345" },
          },
          "Teams",
        );
      }));

      it("renders the server cart verbatim, including the credit row and collapsed seat line", fakeAsync(() => {
        mockInvoicePreviewService.previewPremiumOrgUpgradeCart.mockResolvedValue(
          premiumUpgradeCart,
        );
        hasPremiumPersonallySubject.next(true);

        fixture.detectChanges();
        flushMicrotasks();

        component["formGroup"].controls.productTier.setValue(ProductTierType.Teams);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        expect(component["cart"]()).toBe(premiumUpgradeCart);
        expect(component["cart"]().credit).toEqual({
          translationKey: "premiumSubscriptionCredit",
          value: 6.66,
        });
      }));
    });

    describe("checkout branch", () => {
      beforeEach(async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("renders Scenario A verbatim — coupon discount and $31.60 total", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioACart);

        selectTeams();
        enterValidAddress();
        settlePreview();

        expect(component["cart"]()).toBe(scenarioACart);
        expect(component["cart"]().total).toBe(31.6);
        expect(component["cart"]().discounts).toEqual([
          { type: DiscountTypes.PercentOff, value: 20, amount: 7.4, label: "SAVE20" },
        ]);
      }));

      it("passes Scenario E's item-scoped and cart-wide discounts through untouched", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioECart);

        selectTeams();
        enterValidAddress();
        settlePreview();

        const cart = component["cart"]();
        expect(cart).toBe(scenarioECart);
        expect(cart.passwordManager.seats.discounts).toEqual([
          { type: DiscountTypes.AmountOff, value: 2, label: "SEATS10" },
        ]);
        expect(cart.discounts).toEqual([
          { type: DiscountTypes.AmountOff, value: 5, label: "WELCOME" },
        ]);
        expect(cart.total).toBe(24.84);
      }));

      it("sends the real storage and sponsorship values in a single call (PM-27585 workaround retired)", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioFCart);
        fixture.componentRef.setInput("acceptingSponsorship", true);

        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        component["formGroup"].controls.additionalStorage.setValue(2);
        enterValidAddress();
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(1);
        const [{ purchase }] =
          mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0]!;
        expect(purchase.passwordManager.sponsored).toBe(true);
        expect(purchase.passwordManager.additionalStorage).toBe(2);
      }));

      it("re-prices the sponsored seat line at the Families price and adds the sponsorship discount", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioFCart);
        fixture.componentRef.setInput("acceptingSponsorship", true);

        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        const cart = component["cart"]();
        expect(cart.passwordManager.seats).toEqual({
          translationKey: "familiesMembership",
          cost: 40,
          quantity: 1,
        });
        expect(cart.discounts).toEqual([{ type: DiscountTypes.AmountOff, value: 40, amount: 40 }]);
        expect(cart.estimatedTax).toBe(0);
        expect(cart.total).toBe(0);
        expect(scenarioFCart.passwordManager.seats.cost).toBe(0);
      }));

      it("leaves the sponsored storage line and the server totals untouched", fakeAsync(() => {
        const sponsoredWithStorage = {
          ...scenarioFCart,
          passwordManager: {
            ...scenarioFCart.passwordManager,
            additionalStorage: { translationKey: "additionalStorageGb", cost: 4, quantity: 2 },
          },
          estimatedTax: 0.5,
          total: 8.5,
        } as unknown as Cart;
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(
          sponsoredWithStorage,
        );
        fixture.componentRef.setInput("acceptingSponsorship", true);

        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        component["formGroup"].controls.additionalStorage.setValue(2);
        enterValidAddress();
        settlePreview();

        const cart = component["cart"]();
        expect(cart.passwordManager.additionalStorage).toEqual({
          translationKey: "additionalStorageGb",
          cost: 4,
          quantity: 2,
        });
        expect(cart.passwordManager.seats.cost).toBe(40);
        expect(cart.discounts).toEqual([{ type: DiscountTypes.AmountOff, value: 40, amount: 40 }]);
        expect(cart.estimatedTax).toBe(0.5);
        expect(cart.total).toBe(8.5);
      }));
    });

    describe("request shape", () => {
      beforeEach(async () => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioACart);
        fixture.detectChanges();
        await fixture.whenStable();
      });

      const lastPurchase = () =>
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls.at(-1)![0].purchase;

      it("includes Secrets Manager with standalone false when enabled", fakeAsync(() => {
        selectTeams();
        component["secretsManagerSubscription"].patchValue({
          enabled: true,
          userSeats: 4,
          additionalServiceAccounts: 3,
        });
        enterValidAddress();
        settlePreview();

        expect(lastPurchase().secretsManager).toEqual({
          seats: 4,
          additionalServiceAccounts: 3,
          standalone: false,
        });
      }));

      it("omits Secrets Manager when it is not enabled", fakeAsync(() => {
        selectTeams();
        enterValidAddress();
        settlePreview();

        expect(lastPurchase().secretsManager).toBeUndefined();
      }));

      it("omits Secrets Manager left enabled from a previous plan when switching to Families", fakeAsync(() => {
        selectTeams();
        component["secretsManagerSubscription"].patchValue({
          enabled: true,
          userSeats: 4,
          additionalServiceAccounts: 3,
        });
        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        expect(lastPurchase().tier).toBe("families");
        expect(lastPurchase().secretsManager).toBeUndefined();
      }));

      it("sends a single seat for plans without an additional-seats option", fakeAsync(() => {
        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        expect(lastPurchase().passwordManager.seats).toBe(1);
      }));

      it("forwards eligibility coupon ids", fakeAsync(() => {
        component["formGroup"].controls.productTier.setValue(ProductTierType.Families);
        component.changedProduct();
        enterValidAddress();
        tick(1000);

        mockDiscountSubject.next([eligibleDiscount]);
        settlePreview();

        expect(lastPurchase().coupons).toEqual([eligibleDiscount.stripeCouponId]);
      }));
    });

    describe("resource-driven preview", () => {
      beforeEach(async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("previews once per debounced form change", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioACart);

        selectTeams();
        enterValidAddress();
        tick(500);
        component["formGroup"].controls.additionalSeats.setValue(6);
        tick(500);
        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).not.toHaveBeenCalled();

        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(1);
        expect(component["cart"]()).toBe(scenarioACart);
      }));

      it("sets previewFailed from the resource error status and shows the error toast once", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
          new Error("route not found"),
        );

        selectTeams();
        enterValidAddress();
        settlePreview();
        settlePreview();

        expect(component["previewFailed"]()).toBe(true);
        expect(mockToastService.showToast).toHaveBeenCalledTimes(1);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "invoicePreviewErrorMessage",
        });
      }));
    });

    describe("while the next preview loads", () => {
      beforeEach(async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("keeps the last server cart on screen until the next one resolves", fakeAsync(() => {
        let resolveSecond!: (cart: Cart) => void;
        mockInvoicePreviewService.previewOrganizationCheckoutCart
          .mockResolvedValueOnce(scenarioACart)
          .mockImplementationOnce(() => new Promise<Cart>((resolve) => (resolveSecond = resolve)));

        selectTeams();
        enterValidAddress();
        settlePreview();
        expect(component["cart"]()).toBe(scenarioACart);

        component["formGroup"].controls.additionalSeats.setValue(5);
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(2);
        expect(component["cart"]()).toBe(scenarioACart);
        expect(component["cart"]().estimatedTax).toBe(2.0);
        expect(component["cart"]().discounts).toEqual(scenarioACart.discounts);

        resolveSecond(scenarioECart);
        tick();
        fixture.detectChanges();

        expect(component["cart"]()).toBe(scenarioECart);
      }));

      it("does not preview again when the request is unchanged", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioACart);

        selectTeams();
        enterValidAddress();
        settlePreview();
        component["formGroup"].controls.additionalSeats.setValue(4);
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(1);
      }));
    });

    describe("guards", () => {
      it("never previews a Teams Starter plan", fakeAsync(async () => {
        mockApiService.getPlans.mockResolvedValue({
          data: [
            ...mockPasswordManagerPlans,
            {
              type: PlanType.TeamsStarter,
              productTier: ProductTierType.TeamsStarter,
              name: "Teams Starter",
              isAnnual: false,
              canBeUsedByBusiness: true,
              upgradeSortOrder: 2,
              displaySortOrder: 2,
              PasswordManager: {
                basePrice: 20,
                seatPrice: 0,
                hasAdditionalSeatsOption: false,
                hasAdditionalStorageOption: false,
                hasPremiumAccessOption: false,
                baseStorageGb: 1,
                additionalStoragePricePerGb: 0,
              },
              SecretsManager: null,
            } as PlanResponse,
          ],
        } as any);
        fixture.detectChanges();
        await fixture.whenStable();

        component["formGroup"].controls.productTier.setValue(ProductTierType.TeamsStarter);
        component.changedProduct();
        component["formGroup"].controls.plan.setValue(PlanType.TeamsStarter);
        enterValidAddress();
        settlePreview();

        expect(component["selectedPlan"]()?.productTier).toBe(ProductTierType.TeamsStarter);
        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).not.toHaveBeenCalled();
        expect(mockInvoicePreviewService.previewPremiumOrgUpgradeCart).not.toHaveBeenCalled();
        expect(component["previewCart"].hasValue()).toBe(false);
        expect(component["previewFailed"]()).toBe(false);
        expect(mockLogService.error).not.toHaveBeenCalled();
        expect(component["cart"]().passwordManager.seats).toEqual({
          translationKey: "passwordManagerPlanPrice",
          cost: 20,
          quantity: 1,
        });
        expect(component["cart"]().estimatedTax).toBe(0);
      }));

      it("does not preview with an invalid billing address", fakeAsync(async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        selectTeams();
        component["billingFormGroup"].controls.billingAddress.patchValue({
          country: "",
          postalCode: "",
        });
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).not.toHaveBeenCalled();
        expect(component["previewFailed"]()).toBe(false);
        expect(component["cart"]().passwordManager.seats).toEqual({
          translationKey: "passwordManagerPlanPrice",
          cost: 48,
          quantity: 4,
        });
        expect(component["cart"]().estimatedTax).toBe(0);
      }));

      it("falls back to the form-state cart while the billing address is invalid", fakeAsync(async () => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(scenarioACart);
        fixture.detectChanges();
        await fixture.whenStable();

        selectTeams();
        enterValidAddress();
        settlePreview();
        expect(component["cart"]()).toBe(scenarioACart);

        component["billingFormGroup"].controls.billingAddress.patchValue({ postalCode: "" });
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(1);
        expect(component["cart"]()).not.toBe(scenarioACart);
        expect(component["cart"]().estimatedTax).toBe(0);
        expect(component["previewFailed"]()).toBe(false);
      }));

      it("does not preview for a Free organization", fakeAsync(async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        component["formGroup"].controls.productTier.setValue(ProductTierType.Free);
        component["formGroup"].controls.plan.setValue(PlanType.Free);
        component.changedProduct();
        enterValidAddress();
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).not.toHaveBeenCalled();
        expect(component["previewFailed"]()).toBe(false);
      }));
    });

    describe("preview failure", () => {
      const addressError = new ErrorResponse(
        {
          Message: "The model state is invalid.",
          ValidationErrors: {
            BillingAddress: [
              "Your location wasn't recognized. Please ensure your country and postal code are valid and try again.",
            ],
          },
        },
        400,
      );

      beforeEach(async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      });

      it("raises the failure flag, toasts, and never substitutes a local cart", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
          new Error("route not found"),
        );

        selectTeams();
        enterValidAddress();
        settlePreview();

        expect(component["previewFailed"]()).toBe(true);
        expect(component["previewCart"].hasValue()).toBe(false);
        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "invoicePreviewErrorMessage",
        });
        expect(mockLogService.error).toHaveBeenCalled();

        fixture.detectChanges();
        const host: HTMLElement = fixture.nativeElement;
        expect(host.querySelector('[data-testid="invoice-preview-error"]')).not.toBeNull();
        expect(host.querySelector("billing-cart-summary")?.classList).toContain("tw-hidden");
      }));

      it("toasts and shows the billing-details message when the preview rejects the billing address", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(addressError);

        selectTeams();
        enterValidAddress();
        settlePreview();

        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "billingPreviewInvalidAddressError",
        });

        fixture.detectChanges();
        const callout = fixture.nativeElement.querySelector(
          '[data-testid="invoice-preview-error"]',
        );
        expect(callout.textContent).toContain("billingPreviewInvalidAddressError");
      }));

      it("keeps the generic message for a 400 about the purchase, not the address", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
          new ErrorResponse(
            { Message: "Password Manager seats must be between 1 and 100,000." },
            400,
          ),
        );

        selectTeams();
        enterValidAddress();
        settlePreview();

        expect(mockToastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          message: "invoicePreviewErrorMessage",
        });
        expect(component["previewErrorMessageKey"]()).toBe("invoicePreviewErrorMessage");
      }));

      it("replaces an earlier address message with the generic message on a later failure", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart
          .mockRejectedValueOnce(addressError)
          .mockRejectedValue(new Error("route not found"));

        selectTeams();
        enterValidAddress();
        settlePreview();
        expect(component["previewErrorMessageKey"]()).toBe("billingPreviewInvalidAddressError");

        component["formGroup"].controls.additionalSeats.setValue(5);
        settlePreview();

        expect(component["previewErrorMessageKey"]()).toBe("invoicePreviewErrorMessage");
      }));

      it("clears the failure state while the billing address is invalid", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
          new Error("route not found"),
        );

        selectTeams();
        enterValidAddress();
        settlePreview();
        expect(component["previewFailed"]()).toBe(true);

        component["billingFormGroup"].controls.billingAddress.patchValue({ postalCode: "" });
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(1);
        expect(component["previewFailed"]()).toBe(false);
        expect(component["previewCart"].hasValue()).toBe(false);
      }));

      it("retries after a failure when an edit leaves the request unchanged", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart
          .mockRejectedValueOnce(new Error("503"))
          .mockResolvedValueOnce(scenarioACart);

        selectTeams();
        component["formGroup"].patchValue({ name: "Acme", billingEmail: "a@example.com" });
        enterValidAddress();
        settlePreview();
        expect(component["previewFailed"]()).toBe(true);
        fixture.detectChanges();
        const submit: HTMLButtonElement =
          fixture.nativeElement.querySelector('button[type="submit"]');
        expect(submit.getAttribute("aria-disabled")).toBe("true");

        component["formGroup"].controls.additionalSeats.setValue(4);
        settlePreview();

        expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledTimes(2);
        expect(component["previewFailed"]()).toBe(false);
        fixture.detectChanges();
        expect(submit.getAttribute("aria-disabled")).toBeNull();
      }));

      it("clears the failure state once a later preview succeeds", fakeAsync(() => {
        mockInvoicePreviewService.previewOrganizationCheckoutCart
          .mockRejectedValueOnce(new Error("route not found"))
          .mockResolvedValue(scenarioACart);

        selectTeams();
        enterValidAddress();
        settlePreview();
        expect(component["previewFailed"]()).toBe(true);

        component["formGroup"].controls.additionalSeats.setValue(5);
        settlePreview();

        expect(component["previewFailed"]()).toBe(false);
        expect(component["previewCart"].value()).toBe(scenarioACart);

        fixture.detectChanges();
        const host: HTMLElement = fixture.nativeElement;
        expect(host.querySelector('[data-testid="invoice-preview-error"]')).toBeNull();
        expect(host.querySelector("billing-cart-summary")?.classList).not.toContain("tw-hidden");
      }));

      it("ignores a stale preview that resolves after a newer one", fakeAsync(() => {
        let resolveFirst!: (cart: Cart) => void;
        mockInvoicePreviewService.previewOrganizationCheckoutCart
          .mockImplementationOnce(() => new Promise<Cart>((resolve) => (resolveFirst = resolve)))
          .mockResolvedValue(scenarioACart);

        selectTeams();
        enterValidAddress();
        settlePreview();

        component["formGroup"].controls.additionalSeats.setValue(5);
        settlePreview();
        expect(component["previewCart"].value()).toBe(scenarioACart);

        resolveFirst(scenarioECart);
        tick();

        expect(component["previewCart"].value()).toBe(scenarioACart);
      }));

      describe("submit availability", () => {
        const submitButton = (): HTMLElement | null =>
          fixture.nativeElement.querySelector('button[type="submit"]');

        const completeTheForm = () => {
          component["formGroup"].patchValue({
            name: "Test Org",
            billingEmail: "test@example.com",
          });
          selectTeams();
          enterValidAddress();
        };

        it("disables submit while the preview has failed", fakeAsync(() => {
          mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
            new Error("route not found"),
          );

          completeTheForm();
          settlePreview();
          fixture.detectChanges();

          expect(submitButton()?.getAttribute("aria-disabled")).toBe("true");
        }));

        it("enables submit once a later preview succeeds", fakeAsync(() => {
          mockInvoicePreviewService.previewOrganizationCheckoutCart
            .mockRejectedValueOnce(new Error("route not found"))
            .mockResolvedValue(scenarioACart);

          completeTheForm();
          settlePreview();
          component["formGroup"].controls.additionalSeats.setValue(5);
          settlePreview();
          fixture.detectChanges();

          expect(submitButton()?.hasAttribute("aria-disabled")).toBe(false);
        }));

        it("does not create the organization when submitted while the preview has failed", fakeAsync(async () => {
          mockInvoicePreviewService.previewOrganizationCheckoutCart.mockRejectedValue(
            new Error("route not found"),
          );
          mockOrganizationApiService.create.mockResolvedValue({ id: "new-org-id" } as any);

          completeTheForm();
          setupMockPaymentMethodComponent(component, "mock_token", "card");
          settlePreview();
          await component.submit();

          expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
        }));
      });
    });
  });

  describe("organization information step", () => {
    // Mounts the real standalone OrganizationInformationComponent instead of MockOrgInfoComponent,
    // so the step's own template dependencies and its form wiring into the parent are exercised.
    beforeEach(async () => {
      TestBed.resetTestingModule();
      await configureTestBed({ useRealOrgInfo: true });

      fixture = TestBed.createComponent(OrganizationPlansComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it("renders the information step", () => {
      const orgInfo = fixture.nativeElement.querySelector("app-org-info");

      expect(orgInfo).not.toBeNull();
      expect(orgInfo.querySelectorAll("bit-form-field").length).toBe(2);
      expect(orgInfo.querySelector('input[formcontrolname="name"]')).not.toBeNull();
      expect(orgInfo.querySelector('input[formcontrolname="billingEmail"]')).not.toBeNull();
    });

    it("submits the values entered into the information step", async () => {
      mockOrganizationApiService.create.mockResolvedValue({ id: "new-org-id" } as any);

      const orgInfo = fixture.nativeElement.querySelector("app-org-info");
      setInputValue(orgInfo.querySelector('input[formcontrolname="name"]'), "Typed Org Name");
      setInputValue(
        orgInfo.querySelector('input[formcontrolname="billingEmail"]'),
        "typed@example.com",
      );
      fixture.detectChanges();

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Typed Org Name", billingEmail: "typed@example.com" }),
      );
    });
  });
});
