// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { RegistrationFinishService } from "@bitwarden/auth/angular";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { InitiationPath, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { RouterService } from "../../../core/router.service";

import { CompleteTrialInitiationComponent } from "./complete-trial-initiation.component";

describe("CompleteTrialInitiationComponent", () => {
  let component: CompleteTrialInitiationComponent;
  let fixture: ComponentFixture<CompleteTrialInitiationComponent>;

  let mockRouter: MockProxy<Router>;
  let mockActivatedRoute: { queryParams: BehaviorSubject<any> };
  let mockConfigService: MockProxy<ConfigService>;
  let mockOrganizationBillingService: MockProxy<OrganizationBillingServiceAbstraction>;
  let mockAccountService: MockProxy<AccountService>;
  let pamBillingSupport$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    mockRouter = mock<Router>();
    mockConfigService = mock<ConfigService>();
    mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
    mockAccountService = mock<AccountService>();

    mockActivatedRoute = {
      queryParams: new BehaviorSubject({}),
    };

    // Mock activeAccount$ to return a valid user ID
    mockAccountService.activeAccount$ = of({ id: "user-id-123" } as any);

    // The PAM billing-support flag, controllable per test. Defaults to off.
    pamBillingSupport$ = new BehaviorSubject<boolean>(false);
    mockConfigService.getFeatureFlag$.mockReturnValue(pamBillingSupport$);

    await TestBed.configureTestingModule({
      declarations: [CompleteTrialInitiationComponent],
      providers: [
        FormBuilder,
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: RouterService, useValue: mock<RouterService>() },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: RegistrationFinishService, useValue: mock<RegistrationFinishService>() },
        { provide: ValidationService, useValue: mock<ValidationService>() },
        {
          provide: LoginStrategyServiceAbstraction,
          useValue: mock<LoginStrategyServiceAbstraction>(),
        },
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompleteTrialInitiationComponent);
    component = fixture.componentInstance;
  });

  describe("Query Parameter Parsing", () => {
    it("should set paymentOptional to true when query param is 'true'", async () => {
      mockActivatedRoute.queryParams.next({
        paymentOptional: "true",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.paymentOptional).toBe(true);
    });

    it("should set paymentOptional to false when query param is not 'true'", async () => {
      mockActivatedRoute.queryParams.next({
        paymentOptional: "false",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.paymentOptional).toBe(false);
    });

    it("should default paymentOptional to false when query param is not present", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.paymentOptional).toBe(false);
    });

    it("should parse trialLength from query params", async () => {
      mockActivatedRoute.queryParams.next({
        trialLength: "7",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.trialLength).toBe(7);
    });

    it("should default trialLength to 7 when not provided", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.trialLength).toBe(7);
    });

    it("should read salesAssistedToken from query params", async () => {
      mockActivatedRoute.queryParams.next({
        salesAssistedToken: "sales-assisted-token-123",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.salesAssistedToken).toBe("sales-assisted-token-123");
    });
  });

  describe("trial stepper visibility", () => {
    it("shows the stepper for a Password Manager Enterprise tier", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      expect(component.useTrialStepper).toBe(true);
    });

    it("shows the stepper for any Secrets Manager tier", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.SecretsManager,
        productTier: ProductTierType.Free,
      });
      expect(component.useTrialStepper).toBe(true);
    });

    it("hides the stepper when no tier is provided", () => {
      mockActivatedRoute.queryParams.next({ product: ProductType.PasswordManager });
      expect(component.useTrialStepper).toBe(false);
    });
  });

  describe("finishRegistration()", () => {
    it("should forward salesAssistedToken to finishRegistration", async () => {
      const registrationFinishService = TestBed.inject(
        RegistrationFinishService,
      ) as MockProxy<RegistrationFinishService>;
      registrationFinishService.finishRegistration.mockResolvedValue(undefined);

      mockActivatedRoute.queryParams.next({
        email: "test@example.com",
        token: "email-verification-token",
        salesAssistedToken: "sales-assisted-token-123",
      });

      const passwordInputResult = {} as any;
      await component.finishRegistration(passwordInputResult);

      expect(registrationFinishService.finishRegistration).toHaveBeenCalledWith(
        "test@example.com",
        passwordInputResult,
        "email-verification-token",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "sales-assisted-token-123",
      );
    });
  });

  describe("showBillingStep getter", () => {
    it("should hide billing step when paymentOptional is true", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "true",
      });

      expect(component.showBillingStep).toBe(false);
    });

    it("should show billing step when paymentOptional is false", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "false",
      });

      expect(component.showBillingStep).toBe(true);
    });

    it("should hide billing step for Secrets Manager Free regardless of other conditions", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.SecretsManager,
        productTier: ProductTierType.Free,
        paymentOptional: "false",
      });

      expect(component.showBillingStep).toBe(false);
    });
  });

  describe("Organization Creation Flow", () => {
    beforeEach(() => {
      component.orgInfoFormGroup.patchValue({
        name: "Test Org",
        billingEmail: "test@example.com",
      });
    });

    it("should call createOrganizationOnTrial when paymentOptional is true and trialLength > 0", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        trialLength: "7",
        paymentOptional: "true",
      });

      const createOnTrialSpy = jest
        .spyOn(component, "createOrganizationOnTrial")
        .mockResolvedValue(undefined);
      const conditionalCreateSpy = jest
        .spyOn(component as any, "conditionallyCreateOrganization")
        .mockResolvedValue(undefined);

      await component.orgNameEntrySubmit();

      expect(createOnTrialSpy).toHaveBeenCalled();
      expect(conditionalCreateSpy).not.toHaveBeenCalled();
    });

    it("should call conditionallyCreateOrganization when paymentOptional is true but trialLength is 0", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        trialLength: "0",
        paymentOptional: "true",
      });

      const createOnTrialSpy = jest
        .spyOn(component, "createOrganizationOnTrial")
        .mockResolvedValue(undefined);
      const conditionalCreateSpy = jest
        .spyOn(component as any, "conditionallyCreateOrganization")
        .mockResolvedValue(undefined);

      await component.orgNameEntrySubmit();

      expect(createOnTrialSpy).not.toHaveBeenCalled();
      expect(conditionalCreateSpy).toHaveBeenCalled();
    });

    it("should call conditionallyCreateOrganization when paymentOptional is false", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        trialLength: "7",
        paymentOptional: "false",
      });

      const createOnTrialSpy = jest
        .spyOn(component, "createOrganizationOnTrial")
        .mockResolvedValue(undefined);
      const conditionalCreateSpy = jest
        .spyOn(component as any, "conditionallyCreateOrganization")
        .mockResolvedValue(undefined);

      await component.orgNameEntrySubmit();

      expect(createOnTrialSpy).not.toHaveBeenCalled();
      expect(conditionalCreateSpy).toHaveBeenCalled();
    });
  });

  describe("createOrganizationOnTrial", () => {
    beforeEach(() => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });
      component.orgInfoFormGroup.patchValue({
        name: "Test Org",
        billingEmail: "test@example.com",
      });
      component.verticalStepper = { next: jest.fn() } as any;
      mockOrganizationBillingService.purchaseSubscriptionNoPaymentMethod.mockResolvedValue({
        id: "org-id",
        name: "Test Org",
      } as any);
    });

    const passedInitiationPath = () =>
      mockOrganizationBillingService.purchaseSubscriptionNoPaymentMethod.mock.calls[0][0]
        .organization.initiationPath;

    it("uses the marketing website path for Password Manager without a salesAssistedToken", async () => {
      await component.createOrganizationOnTrial("user-id-123" as UserId);

      expect(passedInitiationPath()).toBe(InitiationPath.PasswordManagerTrialFromMarketingWebsite);
    });

    it("uses the sales-assisted path for Password Manager when salesAssistedToken is present", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        salesAssistedToken: "sales-assisted-token-123",
      });

      await component.createOrganizationOnTrial("user-id-123" as UserId);

      expect(passedInitiationPath()).toBe(InitiationPath.SalesAssistedTrialFromAdminPortal);
    });

    it("uses the marketing website path for Secrets Manager without a salesAssistedToken", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.SecretsManager,
        productTier: ProductTierType.Enterprise,
      });

      await component.createOrganizationOnTrial("user-id-123" as UserId);

      expect(passedInitiationPath()).toBe(InitiationPath.SecretsManagerTrialFromMarketingWebsite);
    });

    it("uses the sales-assisted path for Secrets Manager when salesAssistedToken is present", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.SecretsManager,
        productTier: ProductTierType.Enterprise,
        salesAssistedToken: "sales-assisted-token-123",
      });

      await component.createOrganizationOnTrial("user-id-123" as UserId);

      expect(passedInitiationPath()).toBe(InitiationPath.SalesAssistedTrialFromAdminPortal);
    });
  });

  describe("Privileged Controls", () => {
    it("parses the product list when the flag is on", async () => {
      pamBillingSupport$.next(true);
      mockActivatedRoute.queryParams.next({
        product: "0,2",
        productTier: ProductTierType.Enterprise,
      });
      expect(component.product).toBe(ProductType.PasswordManager);
      expect(component.includesPrivilegedControls).toBe(true);
    });

    it("ignores Privileged Controls when the flag is off", async () => {
      pamBillingSupport$.next(false);
      mockActivatedRoute.queryParams.next({
        product: "0,2",
        productTier: ProductTierType.Enterprise,
      });
      expect(component.product).toBe(ProductType.PasswordManager);
      expect(component.includesPrivilegedControls).toBe(false);
    });

    it("does not add Privileged Controls to a Secrets Manager trial", async () => {
      pamBillingSupport$.next(true);
      mockActivatedRoute.queryParams.next({
        product: "1,2",
        productTier: ProductTierType.Enterprise,
      });

      expect(component.product).toBe(ProductType.SecretsManager);
      expect(component.includesPrivilegedControls).toBe(false);
    });

    it("does not add Privileged Controls on a non-Enterprise tier", async () => {
      pamBillingSupport$.next(true);
      mockActivatedRoute.queryParams.next({
        product: "0,2",
        productTier: ProductTierType.Families,
      });

      expect(component.product).toBe(ProductType.PasswordManager);
      expect(component.includesPrivilegedControls).toBe(false);
    });

    it("exposes Privileged Controls at a seat minimum of 1 on the trial getter when included", async () => {
      pamBillingSupport$.next(true);
      mockActivatedRoute.queryParams.next({
        product: "0,2",
        productTier: ProductTierType.Enterprise,
      });
      expect(component.trial.privilegedControls).toEqual({ seatMinimum: 1 });
    });

    it("carries Privileged Controls into the no-payment org creation", async () => {
      pamBillingSupport$.next(true);
      mockActivatedRoute.queryParams.next({
        product: "0,2",
        productTier: ProductTierType.Enterprise,
      });
      component.orgInfoFormGroup.patchValue({ name: "Test Org", billingEmail: "test@example.com" });
      component.verticalStepper = { next: jest.fn() } as any;
      mockOrganizationBillingService.purchaseSubscriptionNoPaymentMethod.mockResolvedValue({
        id: "org-id",
        name: "Test Org",
      } as any);

      await component.createOrganizationOnTrial("user-id-123" as UserId);

      const plan =
        mockOrganizationBillingService.purchaseSubscriptionNoPaymentMethod.mock.calls[0][0].plan;
      expect(plan).toEqual(
        expect.objectContaining({
          passwordManagerSeats: 1,
          subscribeToPrivilegedControls: true,
          pamSeatMinimum: 1,
        }),
      );
    });
  });

  describe("Integration: paymentOptional acceptance criteria", () => {
    it("AC2: should hide billing step when paymentOptional=true regardless of trialLength", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "true",
        trialLength: "7",
      });
      expect(component.showBillingStep).toBe(false);

      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "true",
        trialLength: "0",
      });
      expect(component.showBillingStep).toBe(false);
    });

    it("should show billing step when paymentOptional=false", () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "false",
        trialLength: "7",
      });
      expect(component.showBillingStep).toBe(true);

      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
        paymentOptional: "false",
        trialLength: "0",
      });
      expect(component.showBillingStep).toBe(true);
    });
  });
});
