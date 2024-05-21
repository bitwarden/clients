import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed } from "@angular/core/testing";
import { FormBuilder, UntypedFormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { ProductType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { RouterService } from "../../../core";
import { SharedModule } from "../../../shared";
import { VerticalStepperComponent } from "../vertical-stepper/vertical-stepper.component";

import { Product } from "./enums/product";
import { FinishSignUpComponent } from "./finish-sign-up.component";

describe("FinishSignUpComponent", () => {
  let component: FinishSignUpComponent;
  let fixture: ComponentFixture<FinishSignUpComponent>;
  const mockQueryParams = new BehaviorSubject<any>({ org: "enterprise" });
  const testOrgId = "91329456-5b9f-44b3-9279-6bb9ee6a0974";
  const formBuilder: FormBuilder = new FormBuilder();
  let routerSpy: jest.SpyInstance;

  let stateServiceMock: MockProxy<StateService>;
  let policyApiServiceMock: MockProxy<PolicyApiServiceAbstraction>;
  let policyServiceMock: MockProxy<PolicyService>;
  let organizationBillingMock: MockProxy<OrganizationBillingServiceAbstraction>;

  beforeEach(async () => {
    // only define services directly that we want to mock return values in this component
    stateServiceMock = mock<StateService>();
    policyApiServiceMock = mock<PolicyApiServiceAbstraction>();
    policyServiceMock = mock<PolicyService>();
    organizationBillingMock = mock<OrganizationBillingServiceAbstraction>();
    organizationBillingMock.startFree
      .mockClear()
      .mockResolvedValue({ id: "22-33-44" } as OrganizationResponse);

    await TestBed.configureTestingModule({
      imports: [
        SharedModule,
        RouterTestingModule.withRoutes([
          { path: "trial", component: FinishSignUpComponent },
          {
            path: `organizations/${testOrgId}/vault`,
            component: BlankComponent,
          },
          {
            path: `organizations/${testOrgId}/members`,
            component: BlankComponent,
          },
          {
            path: `sm/${testOrgId}`,
            component: BlankComponent,
          },
        ]),
      ],
      declarations: [FinishSignUpComponent, I18nPipe],
      providers: [
        UntypedFormBuilder,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: mockQueryParams.asObservable(),
          },
        },
        { provide: StateService, useValue: stateServiceMock },
        { provide: PolicyService, useValue: policyServiceMock },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiServiceMock },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: mock<I18nService>({
            t: (key: string) => key,
          }),
        },
        { provide: TitleCasePipe, useValue: mock<TitleCasePipe>() },
        {
          provide: VerticalStepperComponent,
          useClass: VerticalStepperStubComponent,
        },
        {
          provide: RouterService,
          useValue: mock<RouterService>(),
        },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: organizationBillingMock,
        },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Allows child components to be ignored (such as register component)
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FinishSignUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // These tests demonstrate mocking service calls
  describe("onInit() enforcedPolicyOptions", () => {
    it("should not set enforcedPolicyOptions if state service returns no invite", async () => {
      stateServiceMock.getOrganizationInvitation.mockReturnValueOnce(null);
      // Need to recreate component with new service mock
      fixture = TestBed.createComponent(FinishSignUpComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();

      expect(component.enforcedPolicyOptions).toBe(undefined);
    });

    it("should set enforcedPolicyOptions if state service returns an invite", async () => {
      // Set up service method mocks
      stateServiceMock.getOrganizationInvitation.mockReturnValueOnce(
        Promise.resolve({
          organizationId: testOrgId,
          token: "token",
          email: "testEmail",
          organizationUserId: "123",
        }),
      );
      policyApiServiceMock.getPoliciesByToken.mockReturnValueOnce(
        Promise.resolve({
          data: [
            {
              id: "345",
              organizationId: testOrgId,
              type: 1,
              data: [
                {
                  minComplexity: 4,
                  minLength: 10,
                  requireLower: null,
                  requireNumbers: null,
                  requireSpecial: null,
                  requireUpper: null,
                },
              ],
              enabled: true,
            },
          ],
        } as ListResponse<PolicyResponse>),
      );
      policyServiceMock.masterPasswordPolicyOptions$.mockReturnValue(
        of({
          minComplexity: 4,
          minLength: 10,
          requireLower: null,
          requireNumbers: null,
          requireSpecial: null,
          requireUpper: null,
        } as MasterPasswordPolicyOptions),
      );

      // Need to recreate component with new service mocks
      fixture = TestBed.createComponent(FinishSignUpComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      expect(component.enforcedPolicyOptions).toMatchObject({
        minComplexity: 4,
        minLength: 10,
        requireLower: null,
        requireNumbers: null,
        requireSpecial: null,
        requireUpper: null,
      });
    });
  });

  // These tests demonstrate route params
  describe("Route params", () => {
    describe("product", () => {
      it("defaults to PasswordManager for an invalid product", async () => {
        mockQueryParams.next({ product: "nintendo-64" });

        await component.ngOnInit();

        expect(component.product).toBe(Product.PasswordManager);
      });

      it("accepts to PasswordManager as a product", async () => {
        mockQueryParams.next({ product: Product.PasswordManager });

        await component.ngOnInit();

        expect(component.product).toBe(Product.PasswordManager);
      });

      it("accepts to SecretsManager as a product", async () => {
        mockQueryParams.next({ product: Product.SecretsManager });

        await component.ngOnInit();

        expect(component.product).toBe(Product.SecretsManager);
      });
    });

    describe("planType", () => {
      describe("SecretsManager", () => {
        [ProductType.Free, ProductType.Families, ProductType.Teams, ProductType.Enterprise].forEach(
          (planType) => {
            describe(`${ProductType[planType]}`, () => {
              it("sets `planType` attribute", async () => {
                mockQueryParams.next({ product: Product.SecretsManager, planType });
                await component.ngOnInit();

                expect(component.planType).toBe(planType);
              });

              it("shows the trial stepper", async () => {
                mockQueryParams.next({ product: Product.SecretsManager, planType });
                await component.ngOnInit();

                expect(component.useTrialStepper).toBe(true);
              });
            });
          },
        );
      });

      describe("PasswordManager", () => {
        [ProductType.Families, ProductType.Teams, ProductType.Enterprise].forEach((planType) => {
          describe(`${ProductType[planType]}`, () => {
            it("sets `planType` attribute", async () => {
              mockQueryParams.next({ product: Product.PasswordManager, planType });
              await component.ngOnInit();

              expect(component.planType).toBe(planType);
            });

            it("shows the trial stepper", async () => {
              mockQueryParams.next({ product: Product.PasswordManager, planType });
              await component.ngOnInit();

              expect(component.useTrialStepper).toBe(true);
            });
          });
        });

        describe(`${ProductType[ProductType.Free]}`, () => {
          beforeEach(() => {
            component.planType = undefined;
          });

          it("does not set `planType` attribute", async () => {
            mockQueryParams.next({ product: Product.PasswordManager, planType: ProductType.Free });
            await component.ngOnInit();

            expect(component.planType).toBe(undefined);
          });

          it("does not show the trial stepper", async () => {
            mockQueryParams.next({ product: Product.PasswordManager, planType: ProductType.Free });
            await component.ngOnInit();

            expect(component.useTrialStepper).toBe(false);
          });
        });
      });
    });
  });

  // These tests demonstrate the use of a stub component
  describe("createAccount()", () => {
    beforeEach(() => {
      component.verticalStepper = TestBed.createComponent(VerticalStepperStubComponent)
        .componentInstance as VerticalStepperComponent;
    });

    it("should set email and call verticalStepper.next()", fakeAsync(() => {
      const verticalStepperNext = jest.spyOn(component.verticalStepper, "next");
      component.createdAccount("test@email.com");
      expect(verticalStepperNext).toHaveBeenCalled();
      expect(component.email).toBe("test@email.com");
    }));
  });

  describe("billingSuccess()", () => {
    beforeEach(() => {
      component.verticalStepper = TestBed.createComponent(VerticalStepperStubComponent)
        .componentInstance as VerticalStepperComponent;
    });

    it("should set orgId and call verticalStepper.next()", () => {
      const verticalStepperNext = jest.spyOn(component.verticalStepper, "next");
      component.billingSuccess({ orgId: testOrgId });
      expect(verticalStepperNext).toHaveBeenCalled();
      expect(component.orgId).toBe(testOrgId);
    });
  });

  describe("stepSelectionChange()", () => {
    beforeEach(() => {
      component.verticalStepper = TestBed.createComponent(VerticalStepperStubComponent)
        .componentInstance as VerticalStepperComponent;
    });

    it("on step 2 should show organization copy text", () => {
      component.planType = ProductType.Families;
      component.stepSelectionChange({
        selectedIndex: 1,
        previouslySelectedIndex: 0,
      } as StepperSelectionEvent);

      expect(component.orgInfoSubLabel).toBe("enterFamiliesOrgInfo");
    });

    it("going from step 2 to 3 should set the orgInforSubLabel to be the Org name from orgInfoFormGroup", () => {
      component.orgInfoFormGroup = formBuilder.group({
        name: ["Hooli"],
        email: [""],
      });
      component.stepSelectionChange({
        selectedIndex: 2,
        previouslySelectedIndex: 1,
      } as StepperSelectionEvent);

      expect(component.orgInfoSubLabel).toContain("Hooli");
    });
  });

  describe("conditionallyCreateOrganization()", () => {
    beforeEach(() => {
      component.verticalStepper = { next: jest.fn() } as any;
    });

    it("navigates to next step when the product is password manager", async () => {
      component.product = Product.PasswordManager;
      await component.conditionallyCreateOrganization();

      expect(component.verticalStepper.next).toHaveBeenCalled();
      expect(organizationBillingMock.startFree).not.toHaveBeenCalled();
    });

    describe("SecretsManager", () => {
      beforeEach(() => {
        component.product = Product.SecretsManager;
      });

      [ProductType.Families, ProductType.Teams, ProductType.Enterprise].forEach((planType) => {
        describe(`${ProductType[planType]}`, () => {
          it("navigates to the next step", async () => {
            component.planType = planType;
            await component.conditionallyCreateOrganization();

            expect(component.verticalStepper.next).toHaveBeenCalled();
            expect(organizationBillingMock.startFree).not.toHaveBeenCalled();
          });
        });
      });

      describe(`${ProductType[ProductType.Free]}`, () => {
        it("creates an organization", async () => {
          component.orgInfoFormGroup = formBuilder.group({
            name: ["Ron Burgundy"],
            email: ["ron@channel4.com"],
          });

          component.planType = ProductType.Free;
          await component.conditionallyCreateOrganization();

          expect(organizationBillingMock.startFree).toHaveBeenCalledWith({
            organization: {
              billingEmail: "ron@channel4.com",
              name: "Ron Burgundy",
            },
            plan: {
              isFromSecretsManagerTrial: true,
              subscribeToSecretsManager: true,
              type: ProductType.Free,
            },
          });

          expect(component.orgId).toBe("22-33-44");
          expect(component.verticalStepper.next).toHaveBeenCalled();
        });
      });
    });
  });

  describe("previousStep()", () => {
    beforeEach(() => {
      component.verticalStepper = TestBed.createComponent(VerticalStepperStubComponent)
        .componentInstance as VerticalStepperComponent;
    });

    it("should call verticalStepper.previous()", fakeAsync(() => {
      const verticalStepperPrevious = jest.spyOn(component.verticalStepper, "previous");
      component.previousStep();
      expect(verticalStepperPrevious).toHaveBeenCalled();
    }));
  });

  // These tests demonstrate router navigation
  describe("navigation methods", () => {
    beforeEach(() => {
      component.orgId = testOrgId;
      const router = TestBed.inject(Router);
      fixture.detectChanges();
      routerSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);
    });

    describe("getStartedNavigation", () => {
      it("navigates to the vault", async () => {
        component.product = Product.PasswordManager;
        await component.getStartedNavigation();

        expect(routerSpy).toHaveBeenCalledWith(["organizations", testOrgId, "vault"]);
      });

      it("navigates to secrets manager", async () => {
        component.product = Product.SecretsManager;
        await component.getStartedNavigation();

        expect(routerSpy).toHaveBeenCalledWith(["sm", testOrgId]);
      });
    });

    describe("inviteUsersNavigation", () => {
      it("navigates to members page", async () => {
        component.product = Product.SecretsManager;
        await component.inviteUsersNavigation();

        expect(routerSpy).toHaveBeenCalledWith(["organizations", testOrgId, "members"]);

        routerSpy.mockClear();

        component.product = Product.PasswordManager;
        await component.inviteUsersNavigation();

        expect(routerSpy).toHaveBeenCalledWith(["organizations", testOrgId, "members"]);
      });
    });
  });
});

export class VerticalStepperStubComponent extends VerticalStepperComponent {}
export class BlankComponent {} // For router tests
