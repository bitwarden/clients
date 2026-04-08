// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { RegistrationFinishService } from "@bitwarden/auth/angular";
import { LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

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

    // Mock getFeatureFlag$ to return false by default
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      declarations: [CompleteTrialInitiationComponent],
      providers: [
        FormBuilder,
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: RouterService, useValue: mock<RouterService>() },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: OrganizationInviteService, useValue: mock<OrganizationInviteService>() },
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

      await component.ngOnInit();
      await fixture.whenStable();

      expect(component.paymentOptional).toBe(true);
    });

    it("should set paymentOptional to false when query param is not 'true'", async () => {
      mockActivatedRoute.queryParams.next({
        paymentOptional: "false",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });

      await component.ngOnInit();
      await fixture.whenStable();

      expect(component.paymentOptional).toBe(false);
    });

    it("should default paymentOptional to false when query param is not present", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });

      await component.ngOnInit();
      await fixture.whenStable();

      expect(component.paymentOptional).toBe(false);
    });

    it("should parse trialLength from query params", async () => {
      mockActivatedRoute.queryParams.next({
        trialLength: "7",
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });

      await component.ngOnInit();
      await fixture.whenStable();

      expect(component.trialLength).toBe(7);
    });

    it("should default trialLength to 7 when not provided", async () => {
      mockActivatedRoute.queryParams.next({
        product: ProductType.PasswordManager,
        productTier: ProductTierType.Enterprise,
      });

      await component.ngOnInit();
      await fixture.whenStable();

      expect(component.trialLength).toBe(7);
    });
  });

  describe("showBillingStep getter", () => {
    beforeEach(() => {
      component.product = ProductType.PasswordManager;
      component.productTier = ProductTierType.Enterprise;
    });

    it("should hide billing step when paymentOptional is true", () => {
      component.paymentOptional = true;

      expect(component.showBillingStep).toBe(false);
    });

    it("should show billing step when paymentOptional is false", () => {
      component.paymentOptional = false;

      expect(component.showBillingStep).toBe(true);
    });

    it("should hide billing step for Secrets Manager Free regardless of other conditions", () => {
      component.product = ProductType.SecretsManager;
      component.productTier = ProductTierType.Free;
      component.paymentOptional = false;

      expect(component.showBillingStep).toBe(false);
    });
  });

  describe("Organization Creation Flow", () => {
    beforeEach(() => {
      component.product = ProductType.PasswordManager;
      component.productTier = ProductTierType.Enterprise;
      component.orgInfoFormGroup.patchValue({
        name: "Test Org",
        billingEmail: "test@example.com",
      });
    });

    it("should call createOrganizationOnTrial when paymentOptional is true and trialLength > 0", async () => {
      component.trialLength = 7;
      component.paymentOptional = true;

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
      component.trialLength = 0;
      component.paymentOptional = true;

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
      component.trialLength = 7;
      component.paymentOptional = false;

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

  describe("Integration: paymentOptional acceptance criteria", () => {
    beforeEach(() => {
      component.product = ProductType.PasswordManager;
      component.productTier = ProductTierType.Enterprise;
    });

    it("AC2: should hide billing step when paymentOptional=true regardless of trialLength", () => {
      component.paymentOptional = true;
      component.trialLength = 7;

      expect(component.showBillingStep).toBe(false);

      component.trialLength = 0;
      expect(component.showBillingStep).toBe(false);
    });

    it("should show billing step when paymentOptional=false", () => {
      component.paymentOptional = false;
      component.trialLength = 7;

      expect(component.showBillingStep).toBe(true);

      component.trialLength = 0;
      expect(component.showBillingStep).toBe(true);
    });
  });
});
