// These are disabled until we can migrate to signals and remove the use of @Input properties that are used within the mocked child components
/* eslint-disable @angular-eslint/prefer-output-emitter-ref */
/* eslint-disable @angular-eslint/prefer-signals */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import {
  PreviewInvoiceClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";

import { OrganizationInformationComponent } from "../../admin-console/organizations/create/organization-information.component";
import { EnterBillingAddressComponent, EnterPaymentMethodComponent } from "../payment/components";
import { SecretsManagerSubscribeComponent } from "../shared";
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

// Test Helper Functions

/**
 * Sets up mock encryption keys and org key services
 */
const setupMockEncryptionKeys = (
  mockKeyService: jest.Mocked<KeyService>,
  mockEncryptService: jest.Mocked<EncryptService>,
) => {
  mockKeyService.makeOrgKey.mockResolvedValue([{ encryptedString: "mock-key" }, {} as any] as any);

  mockEncryptService.encryptString.mockResolvedValue({
    encryptedString: "mock-collection",
  } as any);

  mockKeyService.makeKeyPair.mockResolvedValue([
    "public-key",
    { encryptedString: "private-key" },
  ] as any);
};

/**
 * Sets up a mock payment method component that returns a successful tokenization
 */
const setupMockPaymentMethodComponent = (
  component: OrganizationPlansComponent,
  token = "mock_token",
  type = "card",
) => {
  component["enterPaymentMethodComponent"] = {
    tokenize: jest.fn().mockResolvedValue({ token, type }),
  } as any;
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
  component.billingFormGroup.controls.billingAddress.patchValue({
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
 * Sets up a mock organization for upgrade scenarios
 */
const setupMockUpgradeOrganization = (
  mockOrganizationApiService: jest.Mocked<OrganizationApiServiceAbstraction>,
  organizationsSubject: BehaviorSubject<Organization[]>,
  orgConfig: {
    id?: string;
    productTierType?: ProductTierType;
    hasPaymentSource?: boolean;
    planType?: PlanType;
    seats?: number;
    maxStorageGb?: number;
    hasPublicAndPrivateKeys?: boolean;
    useSecretsManager?: boolean;
    smSeats?: number;
    smServiceAccounts?: number;
  } = {},
) => {
  const {
    id = "org-123",
    productTierType = ProductTierType.Free,
    hasPaymentSource = true,
    planType = PlanType.Free,
    seats = 5,
    maxStorageGb,
    hasPublicAndPrivateKeys = true,
    useSecretsManager = false,
    smSeats,
    smServiceAccounts,
  } = orgConfig;

  const mockOrganization = {
    id,
    name: "Test Org",
    productTierType,
    seats,
    maxStorageGb,
    hasPublicAndPrivateKeys,
    useSecretsManager,
  } as Organization;

  organizationsSubject.next([mockOrganization]);

  mockOrganizationApiService.getBilling.mockResolvedValue({
    paymentSource: hasPaymentSource ? { type: "card" } : null,
  } as any);

  mockOrganizationApiService.getSubscription.mockResolvedValue({
    planType,
    smSeats,
    smServiceAccounts,
  } as any);

  return mockOrganization;
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
  component.formGroup.patchValue({
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

describe("OrganizationPlansComponent", () => {
  let component: OrganizationPlansComponent;
  let fixture: ComponentFixture<OrganizationPlansComponent>;

  // Mock services
  let mockApiService: jest.Mocked<ApiService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;
  let mockKeyService: jest.Mocked<KeyService>;
  let mockEncryptService: jest.Mocked<EncryptService>;
  let mockRouter: jest.Mocked<Router>;
  let mockSyncService: jest.Mocked<SyncService>;
  let mockPolicyService: jest.Mocked<PolicyService>;
  let mockOrganizationService: jest.Mocked<OrganizationService>;
  let mockMessagingService: jest.Mocked<MessagingService>;
  let mockOrganizationApiService: jest.Mocked<OrganizationApiServiceAbstraction>;
  let mockProviderApiService: jest.Mocked<ProviderApiServiceAbstraction>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockSubscriberBillingClient: jest.Mocked<SubscriberBillingClient>;
  let mockPreviewInvoiceClient: jest.Mocked<PreviewInvoiceClient>;
  let mockConfigService: jest.Mocked<ConfigService>;

  // Mock data
  let mockPasswordManagerPlans: PlanResponse[];
  let mockOrganization: Organization;
  let activeAccountSubject: BehaviorSubject<any>;
  let organizationsSubject: BehaviorSubject<Organization[]>;

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
      postProviderCreateOrganization: jest.fn(),
      refreshIdentityToken: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockPlatformUtilsService = {
      isSelfHost: jest.fn().mockReturnValue(false),
    } as any;

    mockKeyService = {
      makeOrgKey: jest.fn(),
      makeKeyPair: jest.fn(),
      orgKeys$: jest.fn().mockReturnValue(of({})),
      providerKeys$: jest.fn().mockReturnValue(of({})),
    } as any;

    mockEncryptService = {
      encryptString: jest.fn(),
      wrapSymmetricKey: jest.fn(),
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
    organizationsSubject = new BehaviorSubject<Organization[]>([]);

    mockAccountService = {
      activeAccount$: activeAccountSubject.asObservable(),
    } as any;

    mockOrganizationService = {
      organizations$: jest.fn().mockReturnValue(organizationsSubject.asObservable()),
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

    mockProviderApiService = {
      getProvider: jest.fn(),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockSubscriberBillingClient = {
      getBillingAddress: jest.fn().mockResolvedValue({
        country: "US",
        postalCode: "12345",
      }),
      updatePaymentMethod: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockPreviewInvoiceClient = {
      previewTaxForOrganizationSubscriptionPurchase: jest.fn().mockResolvedValue({
        tax: 5.0,
        total: 50.0,
      }),
    } as any;

    mockConfigService = {
      getFeatureFlag: jest.fn().mockResolvedValue(true),
    } as any;

    // Setup mock plan data
    mockPasswordManagerPlans = createMockPlans();

    mockApiService.getPlans.mockResolvedValue({
      data: mockPasswordManagerPlans,
    } as any);

    await TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: EncryptService, useValue: mockEncryptService },
        { provide: Router, useValue: mockRouter },
        { provide: SyncService, useValue: mockSyncService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: MessagingService, useValue: mockMessagingService },
        FormBuilder, // Use real FormBuilder
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: ProviderApiServiceAbstraction, useValue: mockProviderApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      // Override the component to replace child components with mocks and provide mock services
      .overrideComponent(OrganizationPlansComponent, {
        remove: {
          imports: [
            OrganizationInformationComponent,
            SecretsManagerSubscribeComponent,
            EnterPaymentMethodComponent,
            EnterBillingAddressComponent,
            OrganizationSelfHostingLicenseUploaderComponent,
          ],
          providers: [PreviewInvoiceClient, SubscriberBillingClient],
        },
        add: {
          imports: [
            MockOrgInfoComponent,
            MockSmSubscribeComponent,
            MockEnterPaymentMethodComponent,
            MockEnterBillingAddressComponent,
            MockOrganizationSelfHostingLicenseUploaderComponent,
          ],
          providers: [
            { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
            { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OrganizationPlansComponent);
    component = fixture.componentInstance;
  });

  describe("component creation", () => {
    it("should create", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize with default values", () => {
      expect(component.loading).toBe(true);
      expect(component.showFree).toBe(true);
      expect(component.showCancel).toBe(false);
      expect(component.productTier).toBe(ProductTierType.Free);
    });
  });

  describe("ngOnInit", () => {
    describe("create organization flow", () => {
      it("should load plans from API", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        expect(mockApiService.getPlans).toHaveBeenCalled();
        expect(component.passwordManagerPlans).toEqual(mockPasswordManagerPlans);
        expect(component.loading).toBe(false);
      });

      it("should set required validators on name and billing email", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        component.formGroup.controls.name.setValue("");
        component.formGroup.controls.billingEmail.setValue("");

        expect(component.formGroup.controls.name.hasError("required")).toBe(true);
        expect(component.formGroup.controls.billingEmail.hasError("required")).toBe(true);
      });

      it("should not load organization data for create flow", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        expect(mockOrganizationApiService.getBilling).not.toHaveBeenCalled();
        expect(mockOrganizationApiService.getSubscription).not.toHaveBeenCalled();
      });
    });

    describe("upgrade organization flow", () => {
      beforeEach(() => {
        mockOrganization = setupMockUpgradeOrganization(
          mockOrganizationApiService,
          organizationsSubject,
          {
            planType: PlanType.FamiliesAnnually2025,
          },
        );

        component.organizationId = mockOrganization.id;
      });

      it("should load existing organization data", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.organization).toEqual(mockOrganization);
        expect(mockOrganizationApiService.getBilling).toHaveBeenCalledWith(mockOrganization.id);
        expect(mockOrganizationApiService.getSubscription).toHaveBeenCalledWith(
          mockOrganization.id,
        );
        expect(mockSubscriberBillingClient.getBillingAddress).toHaveBeenCalledWith({
          type: "organization",
          data: mockOrganization,
        });
        // Verify the form was updated
        expect(component.billingFormGroup.controls.billingAddress.value.country).toBe("US");
        expect(component.billingFormGroup.controls.billingAddress.value.postalCode).toBe("12345");
      });

      it("should not add validators for name and billingEmail in upgrade flow", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        component.formGroup.controls.name.setValue("");
        component.formGroup.controls.billingEmail.setValue("");

        // In upgrade flow, these should not be required
        expect(component.formGroup.controls.name.hasError("required")).toBe(false);
        expect(component.formGroup.controls.billingEmail.hasError("required")).toBe(false);
      });
    });

    describe("feature flags", () => {
      it("should use FamiliesAnnually when PM26462_Milestone_3 is enabled", async () => {
        mockConfigService.getFeatureFlag.mockResolvedValue(true);

        fixture.detectChanges();
        await fixture.whenStable();

        const familyPlan = component["_familyPlan"];
        expect(familyPlan).toBe(PlanType.FamiliesAnnually);
      });

      it("should use FamiliesAnnually2025 when feature flag is disabled", async () => {
        mockConfigService.getFeatureFlag.mockResolvedValue(false);

        fixture.detectChanges();
        await fixture.whenStable();

        const familyPlan = component["_familyPlan"];
        expect(familyPlan).toBe(PlanType.FamiliesAnnually2025);
      });
    });
  });

  describe("organization creation validation flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should prevent submission with invalid form data", async () => {
      component.formGroup.patchValue({
        name: "",
        billingEmail: "invalid-email",
        additionalStorage: -1,
        additionalSeats: 200000,
      });

      await component.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
      expect(component.formGroup.invalid).toBe(true);
    });

    it("should allow submission with valid form data", async () => {
      patchOrganizationForm(component, {
        name: "Valid Organization",
        billingEmail: "valid@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      setupMockEncryptionKeys(mockKeyService, mockEncryptService);
      mockOrganizationApiService.create.mockResolvedValue({
        id: "new-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
    });
  });

  describe("plan selection flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should configure form appropriately when switching between product tiers", () => {
      // Start with Families plan with unsupported features
      component.productTier = ProductTierType.Families;
      component.formGroup.controls.additionalSeats.setValue(10);
      component.formGroup.controls.additionalStorage.setValue(5);
      component.changedProduct();

      // Families doesn't support additional seats
      expect(component.formGroup.controls.additionalSeats.value).toBe(0);
      expect(component.formGroup.controls.plan.value).toBe(PlanType.FamiliesAnnually);

      // Switch to Teams plan which supports additional seats
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      expect(component.formGroup.controls.plan.value).toBe(PlanType.TeamsAnnually);
      // Teams initializes with 1 seat by default
      expect(component.formGroup.controls.additionalSeats.value).toBeGreaterThan(0);

      // Switch to Free plan which doesn't support additional storage
      component.formGroup.controls.additionalStorage.setValue(10);
      component.productTier = ProductTierType.Free;
      component.changedProduct();

      expect(component.formGroup.controls.additionalStorage.value).toBe(0);
    });
  });

  describe("subscription pricing flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should calculate total price based on selected plan options", () => {
      // Select Teams plan and configure options
      component.productTier = ProductTierType.Teams;
      component.changedProduct();
      component.formGroup.controls.additionalSeats.setValue(5);
      component.formGroup.controls.additionalStorage.setValue(10);
      component.formGroup.controls.premiumAccessAddon.setValue(true);

      const pmSubtotal = component.passwordManagerSubtotal;
      // Verify pricing includes all selected options
      expect(pmSubtotal).toBeGreaterThan(0);
      expect(pmSubtotal).toBe(5 * 48 + 10 * 4 + 40); // seats + storage + premium
    });

    it("should calculate pricing with Secrets Manager addon", () => {
      component.productTier = ProductTierType.Teams;
      component.plan = PlanType.TeamsAnnually;

      // Enable Secrets Manager with additional options
      component.secretsManagerForm.patchValue({
        enabled: true,
        userSeats: 3,
        additionalServiceAccounts: 10,
      });

      const smSubtotal = component.secretsManagerSubtotal;
      expect(smSubtotal).toBeGreaterThan(0);

      // Disable Secrets Manager
      component.secretsManagerForm.patchValue({
        enabled: false,
      });

      expect(component.secretsManagerSubtotal).toBe(0);
    });
  });

  describe("tax calculation", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should calculate tax after debounce period", fakeAsync(() => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();
      component.formGroup.controls.additionalSeats.setValue(1);
      component.billingFormGroup.controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
      });

      tick(1500); // Wait for debounce (1000ms)

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalled();
      expect(component["estimatedTax"]).toBe(5.0);
    }));

    it("should not calculate tax with invalid billing address", fakeAsync(() => {
      component.billingFormGroup.controls.billingAddress.patchValue({
        country: "",
        postalCode: "",
      });

      tick(1500);

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).not.toHaveBeenCalled();
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

      setupMockEncryptionKeys(mockKeyService, mockEncryptService);
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

    it("should emit onSuccess after successful creation", async () => {
      const onSuccessSpy = jest.spyOn(component.onSuccess, "emit");

      patchOrganizationForm(component, {
        name: "New Org",
        billingEmail: "test@example.com",
      });

      setupMockEncryptionKeys(mockKeyService, mockEncryptService);
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
      setupMockEncryptionKeys(mockKeyService, mockEncryptService);

      // Mock payment method component to return null (failure)
      component["enterPaymentMethodComponent"] = {
        tokenize: jest.fn().mockResolvedValue(null),
      } as any;

      await component.submit();

      // Should not create organization if payment method validation fails
      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
    });

    it("should block submission when single org policy applies", async () => {
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      // Need to reinitialize after changing policy mock
      const policyFixture = TestBed.createComponent(OrganizationPlansComponent);
      const policyComponent = policyFixture.componentInstance;
      policyFixture.detectChanges();
      await policyFixture.whenStable();

      policyComponent.formGroup.patchValue({
        name: "Test",
        billingEmail: "test@example.com",
      });

      await policyComponent.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
    });
  });

  describe("provider flow", () => {
    beforeEach(() => {
      component.providerId = "provider-123";
    });

    it("should load provider data", async () => {
      mockProviderApiService.getProvider.mockResolvedValue({
        id: "provider-123",
        name: "Test Provider",
      } as any);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockProviderApiService.getProvider).toHaveBeenCalledWith("provider-123");
      expect(component.provider).toBeDefined();
    });

    it("should default to Teams Annual plan for providers", async () => {
      mockProviderApiService.getProvider.mockResolvedValue({} as any);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.plan).toBe(PlanType.TeamsAnnually);
    });

    it("should require clientOwnerEmail for provider flow", async () => {
      mockProviderApiService.getProvider.mockResolvedValue({} as any);

      fixture.detectChanges();
      await fixture.whenStable();

      const clientOwnerEmailControl = component.formGroup.controls.clientOwnerEmail;
      clientOwnerEmailControl.setValue("");

      expect(clientOwnerEmailControl.hasError("required")).toBe(true);
    });

    it("should set businessOwned to true for provider flow", async () => {
      mockProviderApiService.getProvider.mockResolvedValue({} as any);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.formGroup.controls.businessOwned.value).toBe(true);
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

      expect(selfHostedComponent.selfHosted).toBe(true);
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
      component.acceptingSponsorship = false;
      component["isInTrialFlow"] = false;

      await component["onLicenseFileUploaded"]("uploaded-org-id");

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/organizations/uploaded-org-id"]);
    });

    it("should not navigate after license upload if accepting sponsorship", async () => {
      component.acceptingSponsorship = true;

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

      expect(component.singleOrgPolicyAppliesToActiveUser).toBe(true);
    });

    it("should not block provider flow with single org policy", async () => {
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));
      component.providerId = "provider-123";
      mockProviderApiService.getProvider.mockResolvedValue({} as any);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.singleOrgPolicyBlock).toBe(false);
    });
  });

  describe("business ownership change flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should automatically upgrade to business-compatible plan when marking as business-owned", () => {
      // Start with a personal plan
      component.formGroup.controls.businessOwned.setValue(false);
      component.productTier = ProductTierType.Families;
      component.plan = PlanType.FamiliesAnnually;

      // Mark as business-owned
      component.formGroup.controls.businessOwned.setValue(true);
      component.changedOwnedBusiness();

      // Should automatically switch to Teams (lowest business plan)
      expect(component.formGroup.controls.productTier.value).toBe(ProductTierType.Teams);
      expect(component.formGroup.controls.plan.value).toBe(PlanType.TeamsAnnually);

      // Unchecking businessOwned should not force a downgrade
      component.formGroup.controls.businessOwned.setValue(false);
      component.changedOwnedBusiness();

      expect(component.formGroup.controls.productTier.value).toBe(ProductTierType.Teams);
    });
  });

  describe("business organization plan selection flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should restrict available plans based on business ownership and upgrade context", () => {
      // Upgrade flow (showFree = false) should exclude Free plan
      component.showFree = false;
      let products = component.selectableProducts;
      expect(products.find((p) => p.type === PlanType.Free)).toBeUndefined();

      // Create flow (showFree = true) should include Free plan
      component.showFree = true;
      products = component.selectableProducts;
      expect(products.find((p) => p.type === PlanType.Free)).toBeDefined();

      // Business organizations should only see business-compatible plans
      component.formGroup.controls.businessOwned.setValue(true);
      products = component.selectableProducts;
      const nonFreeBusinessPlans = products.filter((p) => p.type !== PlanType.Free);
      nonFreeBusinessPlans.forEach((plan) => {
        expect(plan.canBeUsedByBusiness).toBe(true);
      });
    });
  });

  describe("accepting sponsorship flow", () => {
    beforeEach(() => {
      component.acceptingSponsorship = true;
    });

    it("should configure Families plan with full discount when accepting sponsorship", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      // Only Families plan should be available
      const products = component.selectableProducts;
      expect(products.length).toBe(1);
      expect(products[0].productTier).toBe(ProductTierType.Families);

      // Full discount should be applied making the base price free
      component.productTier = ProductTierType.Families;
      component.plan = PlanType.FamiliesAnnually;

      const subtotal = component.passwordManagerSubtotal;
      expect(subtotal).toBe(0); // Discount covers the full base price
      expect(component.discount).toBe(products[0].PasswordManager.basePrice);
    });
  });

  describe("upgrade flow", () => {
    it("should successfully upgrade organization", async () => {
      setupMockUpgradeOrganization(mockOrganizationApiService, organizationsSubject, {
        maxStorageGb: 2,
      });

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[0]; // Free plan

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      upgradeComponent.productTier = ProductTierType.Teams;
      upgradeComponent.plan = PlanType.TeamsAnnually;
      upgradeComponent.formGroup.controls.additionalSeats.setValue(5);

      mockOrganizationApiService.upgrade.mockResolvedValue(undefined);

      await upgradeComponent.submit();

      expect(mockOrganizationApiService.upgrade).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          planType: PlanType.TeamsAnnually,
          additionalSeats: 5,
        }),
      );

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "organizationUpgraded",
      });
    });

    it("should handle upgrade requiring payment method", async () => {
      setupMockUpgradeOrganization(mockOrganizationApiService, organizationsSubject, {
        hasPaymentSource: false,
        maxStorageGb: 2,
      });

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.showFree = false; // Required for upgradeRequiresPaymentMethod

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      expect(upgradeComponent.upgradeRequiresPaymentMethod).toBe(true);
    });
  });

  describe("billing form display flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should show appropriate billing fields based on plan type", () => {
      // Personal plans (Free, Families) should not require tax ID
      component.productTier = ProductTierType.Free;
      expect(component["showTaxIdField"]).toBe(false);

      component.productTier = ProductTierType.Families;
      expect(component["showTaxIdField"]).toBe(false);

      // Business plans (Teams, Enterprise) should show tax ID field
      component.productTier = ProductTierType.Teams;
      expect(component["showTaxIdField"]).toBe(true);

      component.productTier = ProductTierType.Enterprise;
      expect(component["showTaxIdField"]).toBe(true);
    });
  });

  describe("secrets manager handling flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should prefill SM seats from existing subscription", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Teams,
        useSecretsManager: true,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.TeamsAnnually,
        smSeats: 5,
        smServiceAccounts: 75,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[2]; // Teams plan

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      upgradeComponent.changedProduct();

      expect(upgradeComponent.secretsManagerForm.controls.enabled.value).toBe(true);
      expect(upgradeComponent.secretsManagerForm.controls.userSeats.value).toBe(5);
      expect(upgradeComponent.secretsManagerForm.controls.additionalServiceAccounts.value).toBe(25);
    });

    it("should enable SM by default when enableSecretsManagerByDefault is true", async () => {
      const smFixture = TestBed.createComponent(OrganizationPlansComponent);
      const smComponent = smFixture.componentInstance;
      smComponent.enableSecretsManagerByDefault = true;
      smComponent.productTier = ProductTierType.Teams;

      smFixture.detectChanges();
      await smFixture.whenStable();

      expect(smComponent.secretsManagerForm.value.enabled).toBe(true);
      expect(smComponent.secretsManagerForm.value.userSeats).toBe(1);
      expect(smComponent.secretsManagerForm.value.additionalServiceAccounts).toBe(0);
    });

    it("should trigger tax recalculation when SM form changes", fakeAsync(() => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();
      component.billingFormGroup.controls.billingAddress.patchValue({
        country: "US",
        postalCode: "90210",
      });

      // Clear previous calls
      jest.clearAllMocks();

      // Change SM form
      component.secretsManagerForm.patchValue({
        enabled: true,
        userSeats: 3,
      });

      tick(1500); // Wait for debounce

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalled();
    }));
  });

  describe("form update helpers flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should handle premium addon access based on plan features", () => {
      // Plan without premium access option should set addon to true (meaning it's included)
      component.productTier = ProductTierType.Families;
      component.changedProduct();

      expect(component.formGroup.controls.premiumAccessAddon.value).toBe(true);

      // Plan with premium access option should set addon to false (user can opt-in)
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      expect(component.formGroup.controls.premiumAccessAddon.value).toBe(false);
    });

    it("should handle additional storage for upgrade with existing data", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Free,
        maxStorageGb: 5,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.Free,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[0]; // Free plan with 0 GB base

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      upgradeComponent.productTier = ProductTierType.Teams;
      upgradeComponent.changedProduct();

      expect(upgradeComponent.formGroup.controls.additionalStorage.value).toBe(5);
    });

    it("should reset additional storage when plan doesn't support it", () => {
      component.formGroup.controls.additionalStorage.setValue(10);
      component.productTier = ProductTierType.Free;
      component.changedProduct();

      expect(component.formGroup.controls.additionalStorage.value).toBe(0);
    });

    it("should handle additional seats for various scenarios", () => {
      // Plan without additional seats option should reset to 0
      component.formGroup.controls.additionalSeats.setValue(10);
      component.productTier = ProductTierType.Families;
      component.changedProduct();

      expect(component.formGroup.controls.additionalSeats.value).toBe(0);

      // Default to 1 seat for new org with seats option
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      expect(component.formGroup.controls.additionalSeats.value).toBeGreaterThanOrEqual(1);
    });

    it("should prefill seats from current plan when upgrading from non-seats plan", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Free,
        seats: 2,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.Free,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[0]; // Free plan (no additional seats)

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      upgradeComponent.productTier = ProductTierType.Teams;
      upgradeComponent.changedProduct();

      // Should use base seats from current plan
      expect(upgradeComponent.formGroup.controls.additionalSeats.value).toBe(2);
    });
  });

  describe("provider creation flow", () => {
    beforeEach(() => {
      component.providerId = "provider-123";
      mockProviderApiService.getProvider.mockResolvedValue({
        id: "provider-123",
        name: "Test Provider",
      } as any);
    });

    it("should create organization through provider with wrapped key", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      patchOrganizationForm(component, {
        name: "Provider Client Org",
        billingEmail: "client@example.com",
        productTier: ProductTierType.Teams,
        plan: PlanType.TeamsAnnually,
        additionalSeats: 5,
      });
      component.formGroup.patchValue({
        clientOwnerEmail: "owner@client.com",
      });

      patchBillingAddress(component);

      const mockOrgKey = {} as any;
      const mockProviderKey = {} as any;

      mockKeyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "mock-key" },
        mockOrgKey,
      ] as any);

      mockEncryptService.encryptString.mockResolvedValue({
        encryptedString: "mock-collection",
      } as any);

      mockKeyService.makeKeyPair.mockResolvedValue([
        "public-key",
        { encryptedString: "private-key" },
      ] as any);

      mockKeyService.providerKeys$.mockReturnValue(of({ "provider-123": mockProviderKey }));

      mockEncryptService.wrapSymmetricKey.mockResolvedValue({
        encryptedString: "wrapped-key",
      } as any);

      mockApiService.postProviderCreateOrganization.mockResolvedValue({
        organizationId: "provider-org-id",
      } as any);

      setupMockPaymentMethodComponent(component);

      await component.submit();

      expect(mockApiService.postProviderCreateOrganization).toHaveBeenCalledWith(
        "provider-123",
        expect.objectContaining({
          clientOwnerEmail: "owner@client.com",
        }),
      );

      expect(mockEncryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockOrgKey, mockProviderKey);
    });
  });

  describe("upgrade with missing keys flow", () => {
    beforeEach(async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Free,
        seats: 5,
        hasPublicAndPrivateKeys: false, // Missing keys
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.Free,
      } as any);

      component.organizationId = "org-123";

      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should backfill organization keys during upgrade", async () => {
      component.productTier = ProductTierType.Teams;
      component.plan = PlanType.TeamsAnnually;
      component.formGroup.controls.additionalSeats.setValue(5);

      const mockOrgShareKey = {} as any;
      mockKeyService.orgKeys$.mockReturnValue(of({ "org-123": mockOrgShareKey }));

      mockKeyService.makeKeyPair.mockResolvedValue([
        "public-key",
        { encryptedString: "private-key" },
      ] as any);

      mockOrganizationApiService.upgrade.mockResolvedValue(undefined);

      await component.submit();

      expect(mockOrganizationApiService.upgrade).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          keys: expect.any(Object),
        }),
      );
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

      component.formGroup.patchValue({
        name: "Trial Org",
        billingEmail: "trial@example.com",
        productTier: ProductTierType.Enterprise,
        plan: PlanType.EnterpriseAnnually,
        additionalSeats: 10,
      });

      component.billingFormGroup.controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
        line1: "123 Street",
        city: "City",
        state: "CA",
      });

      mockKeyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "mock-key" },
        {} as any,
      ] as any);

      mockEncryptService.encryptString.mockResolvedValue({
        encryptedString: "mock-collection",
      } as any);

      mockKeyService.makeKeyPair.mockResolvedValue([
        "public-key",
        { encryptedString: "private-key" },
      ] as any);

      mockOrganizationApiService.create.mockResolvedValue({
        id: "trial-org-id",
      } as any);

      component["enterPaymentMethodComponent"] = {
        tokenize: jest.fn().mockResolvedValue({
          token: "mock_token",
          type: "card",
        }),
      } as any;

      await component.submit();

      expect(trialSpy).toHaveBeenCalledWith({
        orgId: "trial-org-id",
        subLabelText: expect.stringContaining("annual"),
      });
    });

    it("should not navigate away when in trial flow", async () => {
      component["isInTrialFlow"] = true;

      component.formGroup.patchValue({
        name: "Trial Org",
        billingEmail: "trial@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      mockKeyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "mock-key" },
        {} as any,
      ] as any);

      mockEncryptService.encryptString.mockResolvedValue({
        encryptedString: "mock-collection",
      } as any);

      mockKeyService.makeKeyPair.mockResolvedValue([
        "public-key",
        { encryptedString: "private-key" },
      ] as any);

      mockOrganizationApiService.create.mockResolvedValue({
        id: "trial-org-id",
      } as any);

      await component.submit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe("upgrade prefill flow", () => {
    it("should prefill Families plan for Free tier upgrade", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Free,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: null,
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.Free,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[0]; // Free

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      expect(upgradeComponent.plan).toBe(PlanType.FamiliesAnnually);
      expect(upgradeComponent.productTier).toBe(ProductTierType.Families);
    });

    it("should prefill Teams plan for Families tier upgrade when TeamsStarter unavailable", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Families,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.FamiliesAnnually,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[1]; // Families

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      expect(upgradeComponent.plan).toBe(PlanType.TeamsAnnually);
      expect(upgradeComponent.productTier).toBe(ProductTierType.Teams);
    });

    it("should use upgradeSortOrder for sequential plan upgrades", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Teams,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.TeamsAnnually,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[2]; // Teams

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      expect(upgradeComponent.plan).toBe(PlanType.EnterpriseAnnually);
      expect(upgradeComponent.productTier).toBe(ProductTierType.Enterprise);
    });

    it("should not prefill for Enterprise tier (no upgrade available)", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Enterprise,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.EnterpriseAnnually,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[3]; // Enterprise

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      // Should not change from default Free
      expect(upgradeComponent.productTier).toBe(ProductTierType.Free);
    });
  });

  describe("plan filtering logic", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should check if provider is qualified for 2020 plans", () => {
      component.providerId = "provider-123";
      component["provider"] = {
        id: "provider-123",
        creationDate: "2023-01-01", // Before cutoff
      } as any;

      const isQualified = component["isProviderQualifiedFor2020Plan"]();

      expect(isQualified).toBe(true);
    });

    it("should not qualify provider created after 2020 plan cutoff", () => {
      component.providerId = "provider-123";
      component["provider"] = {
        id: "provider-123",
        creationDate: "2023-12-01", // After cutoff (2023-11-06)
      } as any;

      const isQualified = component["isProviderQualifiedFor2020Plan"]();

      expect(isQualified).toBe(false);
    });

    it("should return false if provider has no creation date", () => {
      component.providerId = "provider-123";
      component["provider"] = {
        id: "provider-123",
        creationDate: null,
      } as any;

      const isQualified = component["isProviderQualifiedFor2020Plan"]();

      expect(isQualified).toBe(false);
    });

    it("should exclude upgrade-ineligible plans", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Teams,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: { type: "card" },
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.TeamsAnnually,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.currentPlan = mockPasswordManagerPlans[2]; // Teams

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      const products = upgradeComponent.selectableProducts;

      // Should not include plans with lower or equal upgradeSortOrder
      expect(products.find((p) => p.type === PlanType.Free)).toBeUndefined();
      expect(products.find((p) => p.type === PlanType.FamiliesAnnually)).toBeUndefined();
      expect(products.find((p) => p.type === PlanType.TeamsAnnually)).toBeUndefined();
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

    it("should generate billing sublabel text for annual plan", () => {
      component.productTier = ProductTierType.Teams;
      component.plan = PlanType.TeamsAnnually;

      const sublabel = component["billingSubLabelText"]();

      expect(sublabel).toContain("annual");
      expect(sublabel).toContain("$48"); // Seat price
      expect(sublabel).toContain("yr");
    });

    it("should generate billing sublabel text for plan with base price", () => {
      component.productTier = ProductTierType.Families;
      component.plan = PlanType.FamiliesAnnually;

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
      expect(component.loading).toBe(false);

      // When loading
      component.loading = true;
      expect(component.loading).toBe(true);

      // When not loading
      component.loading = false;
      expect(component.loading).toBe(false);
    });

    it("should determine createOrganization based on organizationId", () => {
      // Create flow - no organizationId
      expect(component.createOrganization).toBe(true);

      // Upgrade flow - has organizationId
      component.organizationId = "org-123";
      expect(component.createOrganization).toBe(false);
    });

    it("should calculate passwordManagerSubtotal correctly for paid plans", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();
      component.formGroup.controls.additionalSeats.setValue(5);

      const subtotal = component.passwordManagerSubtotal;

      expect(typeof subtotal).toBe("number");
      expect(subtotal).toBeGreaterThan(0);
    });

    it("should show payment description based on plan type", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      const paymentDesc = component.paymentDesc;

      expect(typeof paymentDesc).toBe("string");
      expect(paymentDesc.length).toBeGreaterThan(0);
    });

    it("should display tax ID field for business plans", () => {
      component.productTier = ProductTierType.Free;
      expect(component["showTaxIdField"]).toBe(false);

      component.productTier = ProductTierType.Families;
      expect(component["showTaxIdField"]).toBe(false);

      component.productTier = ProductTierType.Teams;
      expect(component["showTaxIdField"]).toBe(true);

      component.productTier = ProductTierType.Enterprise;
      expect(component["showTaxIdField"]).toBe(true);
    });

    it("should show single org policy block when applicable", () => {
      component.singleOrgPolicyAppliesToActiveUser = false;
      expect(component.singleOrgPolicyBlock).toBe(false);

      component.singleOrgPolicyAppliesToActiveUser = true;
      expect(component.singleOrgPolicyBlock).toBe(true);

      // But not when has provider
      component.providerId = "provider-123";
      expect(component.singleOrgPolicyBlock).toBe(false);
    });

    it("should determine upgrade requires payment method correctly", async () => {
      // Create flow - no organization
      expect(component.upgradeRequiresPaymentMethod).toBe(false);

      // Create new component with organization setup
      const mockOrg = setupMockUpgradeOrganization(
        mockOrganizationApiService,
        organizationsSubject,
        {
          productTierType: ProductTierType.Free,
          hasPaymentSource: false,
        },
      );

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = mockOrg.id;
      upgradeComponent.showFree = false;

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      expect(upgradeComponent.upgradeRequiresPaymentMethod).toBe(true);
    });
  });

  describe("user interactions and form controls", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should update component state when product tier changes", () => {
      component.productTier = ProductTierType.Free;

      // Simulate changing product tier
      component.productTier = ProductTierType.Teams;
      component.formGroup.controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();

      expect(component.productTier).toBe(ProductTierType.Teams);
      expect(component.formGroup.controls.plan.value).toBe(PlanType.TeamsAnnually);
    });

    it("should update plan when changedOwnedBusiness is called", () => {
      component.formGroup.controls.businessOwned.setValue(false);
      component.productTier = ProductTierType.Families;

      component.formGroup.controls.businessOwned.setValue(true);
      component.changedOwnedBusiness();

      // Should switch to a business-compatible plan
      expect(component.formGroup.controls.productTier.value).toBe(ProductTierType.Teams);
    });

    it("should emit onCanceled when cancel is called", () => {
      const cancelSpy = jest.spyOn(component.onCanceled, "emit");

      component["cancel"]();

      expect(cancelSpy).toHaveBeenCalled();
    });

    it("should update form value when additional seats changes", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      component.formGroup.controls.additionalSeats.setValue(10);

      expect(component.formGroup.controls.additionalSeats.value).toBe(10);
    });

    it("should update form value when additional storage changes", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      component.formGroup.controls.additionalStorage.setValue(5);

      expect(component.formGroup.controls.additionalStorage.value).toBe(5);
    });

    it("should mark form as invalid when required fields are empty", () => {
      component.formGroup.controls.name.setValue("");
      component.formGroup.controls.billingEmail.setValue("");
      component.formGroup.markAllAsTouched();

      expect(component.formGroup.invalid).toBe(true);
    });

    it("should mark form as valid when all required fields are filled correctly", () => {
      patchOrganizationForm(component, {
        name: "Valid Org",
        billingEmail: "valid@example.com",
      });

      expect(component.formGroup.valid).toBe(true);
    });

    it("should calculate subtotals based on form values", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();
      component.formGroup.controls.additionalSeats.setValue(5);
      component.formGroup.controls.additionalStorage.setValue(10);

      const subtotal = component.passwordManagerSubtotal;

      // Should include cost of seats and storage
      expect(subtotal).toBeGreaterThan(0);
    });

    it("should enable Secrets Manager form when plan supports it", () => {
      // Free plan doesn't offer Secrets Manager
      component.productTier = ProductTierType.Free;
      component.formGroup.controls.productTier.setValue(ProductTierType.Free);
      component.changedProduct();
      expect(component.planOffersSecretsManager).toBe(false);

      // Teams plan offers Secrets Manager
      component.productTier = ProductTierType.Teams;
      component.formGroup.controls.productTier.setValue(ProductTierType.Teams);
      component.changedProduct();
      expect(component.planOffersSecretsManager).toBe(true);
      expect(component.secretsManagerForm.disabled).toBe(false);
    });

    it("should update Secrets Manager subtotal when values change", () => {
      component.productTier = ProductTierType.Teams;
      component.changedProduct();

      component.secretsManagerForm.patchValue({
        enabled: false,
      });
      expect(component.secretsManagerSubtotal).toBe(0);

      component.secretsManagerForm.patchValue({
        enabled: true,
        userSeats: 3,
        additionalServiceAccounts: 10,
      });

      const smSubtotal = component.secretsManagerSubtotal;
      expect(smSubtotal).toBeGreaterThan(0);
    });
  });

  describe("payment method and billing flow", () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("should update payment method during upgrade when required", async () => {
      mockOrganization = {
        id: "org-123",
        name: "Test Org",
        productTierType: ProductTierType.Free,
        seats: 5,
        hasPublicAndPrivateKeys: true,
      } as Organization;

      organizationsSubject.next([mockOrganization]);

      mockOrganizationApiService.getBilling.mockResolvedValue({
        paymentSource: null, // No existing payment source
      } as any);

      mockOrganizationApiService.getSubscription.mockResolvedValue({
        planType: PlanType.Free,
      } as any);

      const upgradeFixture = TestBed.createComponent(OrganizationPlansComponent);
      const upgradeComponent = upgradeFixture.componentInstance;
      upgradeComponent.organizationId = "org-123";
      upgradeComponent.showFree = false; // Triggers upgradeRequiresPaymentMethod

      upgradeFixture.detectChanges();
      await upgradeFixture.whenStable();

      upgradeComponent.productTier = ProductTierType.Teams;
      upgradeComponent.plan = PlanType.TeamsAnnually;
      upgradeComponent.formGroup.controls.additionalSeats.setValue(5);

      upgradeComponent.billingFormGroup.controls.billingAddress.patchValue({
        country: "US",
        postalCode: "12345",
        line1: "123 Street",
        city: "City",
        state: "CA",
      });

      upgradeComponent["enterPaymentMethodComponent"] = {
        tokenize: jest.fn().mockResolvedValue({
          token: "new_token",
          type: "card",
        }),
      } as any;

      mockOrganizationApiService.upgrade.mockResolvedValue(undefined);

      await upgradeComponent.submit();

      expect(mockSubscriberBillingClient.updatePaymentMethod).toHaveBeenCalledWith(
        { type: "organization", data: mockOrganization },
        { token: "new_token", type: "card" },
        { country: "US", postalCode: "12345" },
      );

      expect(mockOrganizationApiService.upgrade).toHaveBeenCalled();
    });

    it("should validate billing form for paid plans during creation", async () => {
      component.formGroup.patchValue({
        name: "New Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Teams,
        plan: PlanType.TeamsAnnually,
        additionalSeats: 5,
      });

      // Invalid billing form - explicitly mark as invalid since we removed validators from mock forms
      component.billingFormGroup.controls.billingAddress.patchValue({
        country: "",
        postalCode: "",
      });

      await component.submit();

      expect(mockOrganizationApiService.create).not.toHaveBeenCalled();
      expect(component.billingFormGroup.invalid).toBe(true);
    });

    it("should not require billing validation for Free plan", async () => {
      component.formGroup.patchValue({
        name: "Free Org",
        billingEmail: "test@example.com",
        productTier: ProductTierType.Free,
        plan: PlanType.Free,
      });

      // Leave billing form empty
      component.billingFormGroup.reset();

      mockKeyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "mock-key" },
        {} as any,
      ] as any);

      mockEncryptService.encryptString.mockResolvedValue({
        encryptedString: "mock-collection",
      } as any);

      mockKeyService.makeKeyPair.mockResolvedValue([
        "public-key",
        { encryptedString: "private-key" },
      ] as any);

      mockOrganizationApiService.create.mockResolvedValue({
        id: "free-org-id",
      } as any);

      await component.submit();

      expect(mockOrganizationApiService.create).toHaveBeenCalled();
    });
  });
});
