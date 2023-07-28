import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { FormBuilder, UntypedFormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { PlanType } from "@bitwarden/common/billing/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { RouterService } from "../../core";

import { TrialInitiationComponent } from "./trial-initiation.component";
import { VerticalStepperComponent } from "./vertical-stepper/vertical-stepper.component";

describe("TrialInitiationComponent", () => {
  let component: TrialInitiationComponent;
  let fixture: ComponentFixture<TrialInitiationComponent>;
  const mockQueryParams = new BehaviorSubject<any>({ org: "enterprise" });
  const testOrgId = "91329456-5b9f-44b3-9279-6bb9ee6a0974";
  const formBuilder: FormBuilder = new FormBuilder();
  let routerSpy: jest.SpyInstance;

  let stateServiceMock: MockProxy<StateService>;
  let policyApiServiceMock: MockProxy<PolicyApiServiceAbstraction>;
  let policyServiceMock: MockProxy<PolicyService>;

  beforeEach(() => {
    // only define services directly that we want to mock return values in this component
    stateServiceMock = mock<StateService>();
    policyApiServiceMock = mock<PolicyApiServiceAbstraction>();
    policyServiceMock = mock<PolicyService>();

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "trial", component: TrialInitiationComponent },
          {
            path: `organizations/${testOrgId}/vault`,
            component: BlankComponent,
          },
          {
            path: `organizations/${testOrgId}/members`,
            component: BlankComponent,
          },
        ]),
      ],
      declarations: [TrialInitiationComponent, I18nPipe],
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
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: TitleCasePipe, useValue: mock<TitleCasePipe>() },
        {
          provide: VerticalStepperComponent,
          useClass: VerticalStepperStubComponent,
        },
        {
          provide: RouterService,
          useValue: mock<RouterService>(),
        },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Allows child components to be ignored (such as register component)
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TrialInitiationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  // These tests demonstrate mocking service calls
  describe("onInit() enforcedPolicyOptions", () => {
    it("should not set enforcedPolicyOptions if state service returns no invite", async () => {
      stateServiceMock.getOrganizationInvitation.mockReturnValueOnce(null);
      // Need to recreate component with new service mock
      fixture = TestBed.createComponent(TrialInitiationComponent);
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
        })
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
        } as ListResponse<PolicyResponse>)
      );
      policyServiceMock.masterPasswordPolicyOptions$.mockReturnValue(
        of({
          minComplexity: 4,
          minLength: 10,
          requireLower: null,
          requireNumbers: null,
          requireSpecial: null,
          requireUpper: null,
        } as MasterPasswordPolicyOptions)
      );

      // Need to recreate component with new service mocks
      fixture = TestBed.createComponent(TrialInitiationComponent);
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
    it("should set org variable to be enterprise and plan to EnterpriseAnnually if org param is enterprise", fakeAsync(() => {
      mockQueryParams.next({ org: "enterprise" });
      tick(); // wait for resolution
      fixture = TestBed.createComponent(TrialInitiationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.org).toBe("enterprise");
      expect(component.plan).toBe(PlanType.EnterpriseAnnually);
    }));
    it("should not set org variable if no org param is provided", fakeAsync(() => {
      mockQueryParams.next({});
      tick(); // wait for resolution
      fixture = TestBed.createComponent(TrialInitiationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.org).toBe("");
      expect(component.accountCreateOnly).toBe(true);
    }));
    it("should not set the org if org param is invalid ", fakeAsync(async () => {
      mockQueryParams.next({ org: "hahahaha" });
      tick(); // wait for resolution
      fixture = TestBed.createComponent(TrialInitiationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.org).toBe("");
      expect(component.accountCreateOnly).toBe(true);
    }));
    it("should set the layout variable if layout param is valid ", fakeAsync(async () => {
      mockQueryParams.next({ layout: "teams1" });
      tick(); // wait for resolution
      fixture = TestBed.createComponent(TrialInitiationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.layout).toBe("teams1");
      expect(component.accountCreateOnly).toBe(false);
    }));
    it("should not set the layout variable and leave as 'default' if layout param is invalid ", fakeAsync(async () => {
      mockQueryParams.next({ layout: "asdfasdf" });
      tick(); // wait for resolution
      fixture = TestBed.createComponent(TrialInitiationComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      component.ngOnInit();
      expect(component.layout).toBe("default");
      expect(component.accountCreateOnly).toBe(true);
    }));
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
      component.stepSelectionChange({
        selectedIndex: 1,
        previouslySelectedIndex: 0,
      } as StepperSelectionEvent);

      expect(component.orgInfoSubLabel).toContain("Enter your");
      expect(component.orgInfoSubLabel).toContain(" organization information");
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
      routerSpy = jest.spyOn(router, "navigate");
    });
    describe("navigateToOrgVault", () => {
      it("should call verticalStepper.previous()", fakeAsync(() => {
        component.navigateToOrgVault();
        expect(routerSpy).toHaveBeenCalledWith(["organizations", testOrgId, "vault"]);
      }));
    });
    describe("navigateToOrgVault", () => {
      it("should call verticalStepper.previous()", fakeAsync(() => {
        component.navigateToOrgInvite();
        expect(routerSpy).toHaveBeenCalledWith(["organizations", testOrgId, "members"]);
      }));
    });
  });
});

export class VerticalStepperStubComponent extends VerticalStepperComponent {}
export class BlankComponent {} // For router tests
