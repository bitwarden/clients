// bit-dialog uses IntersectionObserver, which isn't available in jsdom.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule, UntypedFormGroup } from "@angular/forms";
import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import {
  AutoConfirmPolicy,
  AutoConfirmPolicyEditComponent,
} from "../policy-edit-definitions/auto-confirm-policy.component";
import {
  MasterPasswordPolicy,
  MasterPasswordPolicyComponent,
} from "../policy-edit-definitions/master-password.component";
import {
  OrganizationDataOwnershipPolicy,
  OrganizationDataOwnershipPolicyComponent,
} from "../policy-edit-definitions/organization-data-ownership.component";
import { PolicyEditDialogData, PolicyEditDialogResult } from "../policy-edit-drawer.component";

import { PolicyStep } from "./models";
import { MultiStepPolicyEditDialogComponent } from "./multi-step-policy-edit-dialog.component";

describe("MultiStepPolicyEditDialogComponent", () => {
  let component: MultiStepPolicyEditDialogComponent;
  let fixture: ComponentFixture<MultiStepPolicyEditDialogComponent>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let dialogRef: MockProxy<DialogRef<PolicyEditDialogResult>>;
  let policyComponent: MockProxy<BasePolicyEditComponent>;

  const dialogData: PolicyEditDialogData = {
    policy: {
      name: "testPolicy",
      description: "testDesc",
      type: 0,
      component: class {} as any,
      showDescription: true,
      display$: () => of(true),
    } as BasePolicyEditDefinition,
    organization: { id: "org-1" } as Organization,
  };

  beforeEach(async () => {
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockReturnValue("translated");
    dialogRef = mock<DialogRef<PolicyEditDialogResult>>();
    policyComponent = mock<BasePolicyEditComponent>();

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: AuthService, useValue: mock<AuthService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ToastService, useValue: toastService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiStepPolicyEditDialogComponent);
    component = fixture.componentInstance;
    // Intentionally skip detectChanges() to avoid triggering ngAfterViewInit,
    // which calls load() and policyFormViewRef() in the real component.
  });

  /** Sets up the component state as if ngAfterViewInit had run with the given steps. */
  function setupSteps(steps: PolicyStep[]) {
    (component as any).policySteps.set(steps);
    (component as any).policyComponent.set(policyComponent);
  }

  describe("submit()", () => {
    it("throws when policyComponent is not initialized", async () => {
      await expect(component.submit()).rejects.toThrow("PolicyComponent not initialized.");
    });

    it("advances to next step when side effect returns undefined on a non-last step", async () => {
      const sideEffect0 = jest.fn().mockResolvedValue(undefined);
      setupSteps([{ sideEffect: sideEffect0 }, {}]);

      await component.submit();

      expect(component.currentStep()).toBe(1);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("closes dialog with success toast when side effect resolves on the last step", async () => {
      const sideEffect = jest.fn().mockResolvedValue(undefined);
      setupSteps([{ sideEffect }]);

      await component.submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith("saved");
    });

    it("closes dialog immediately when side effect returns { closeDialog: true } on a non-last step", async () => {
      const sideEffect0 = jest.fn().mockResolvedValue({ closeDialog: true });
      const sideEffect1 = jest.fn().mockResolvedValue(undefined);
      setupSteps([{ sideEffect: sideEffect0 }, { sideEffect: sideEffect1 }]);

      await component.submit();

      expect(dialogRef.close).toHaveBeenCalledWith("saved");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      // Step was not advanced since we closed early
      expect(component.currentStep()).toBe(0);
      // Subsequent side effect was never invoked
      expect(sideEffect1).not.toHaveBeenCalled();
    });

    it("shows error toast and does not advance step when side effect throws", async () => {
      const error = new Error("Save failed");
      setupSteps([{ sideEffect: jest.fn().mockRejectedValue(error) }, {}]);

      await component.submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "Save failed" }),
      );
      expect(component.currentStep()).toBe(0);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("advances step on a non-last step when no side effect is defined", async () => {
      setupSteps([{}, {}]);

      await component.submit();

      expect(component.currentStep()).toBe(1);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("closes dialog with success toast on the last step when no side effect is defined", async () => {
      setupSteps([{}]);

      await component.submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(dialogRef.close).toHaveBeenCalledWith("saved");
    });
  });

  describe("saveDisabled signal", () => {
    // These tests set state directly via setupSteps() and use TestBed.flushEffects() to
    // propagate signal changes. This avoids detectChanges(), which would trigger the async
    // ngAfterViewInit and its createComponent() call against the bare (undecorated) test class.

    it("is true when the current step's disableSave observable emits true", () => {
      setupSteps([{ disableSave: of(true) }]);
      TestBed.flushEffects();

      expect((component as any).saveDisabled()).toBe(true);
    });

    it("is false when step has no disableSave and policyComponent has no data", () => {
      policyComponent.data = undefined;
      setupSteps([{}]);
      TestBed.flushEffects();

      expect((component as any).saveDisabled()).toBe(false);
    });

    it("is false when step has no disableSave and the data form is valid", () => {
      policyComponent.data = new UntypedFormGroup({});
      setupSteps([{}]);
      TestBed.flushEffects();

      expect((component as any).saveDisabled()).toBe(false);
    });

    it("reflects the new step's disableSave after advancing to the next step", () => {
      policyComponent.data = undefined;
      setupSteps([{}, { disableSave: of(true) }]);
      TestBed.flushEffects();

      component.currentStep.set(1);
      TestBed.flushEffects();

      expect((component as any).saveDisabled()).toBe(true);
    });
  });

  /**
   * End-to-end regression tests for the production policies that use this dialog
   * (MasterPasswordPolicy, OrganizationDataOwnershipPolicy, AutoConfirmPolicy). These render
   * the REAL policy components (not test doubles) through the REAL dialog.
   */
  describe("Real policy rendering", () => {
    async function setupRealPolicy(policy: BasePolicyEditDefinition) {
      const data: PolicyEditDialogData = {
        policy,
        organization: {
          id: "org-1",
          keyConnectorEnabled: false,
          useMyItems: false,
        } as Organization,
      };

      const i18n = mock<I18nService>();
      i18n.t.mockImplementation((key: any) => key);
      const policyApiService = mock<PolicyApiServiceAbstraction>();
      policyApiService.getPolicy.mockResolvedValue(new PolicyResponse({ Enabled: false }));
      const accountService = mock<AccountService>();
      accountService.activeAccount$ = of({ id: "user-1", email: "user@example.com" } as any);
      const organizationService = mock<OrganizationService>();
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-1", keyConnectorEnabled: false, useMyItems: false } as any]),
      );
      const dRef = mock<DialogRef<PolicyEditDialogResult>>();
      const authService = mock<AuthService>();
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      const policyService = mock<PolicyService>();
      policyService.policies$.mockReturnValue(of([]));
      const router = mock<Router>();
      // DrawerService reads router.url synchronously at construction time.
      (router as any).url = "/";
      (router as any).events = NEVER;

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ReactiveFormsModule],
        providers: [
          { provide: DIALOG_DATA, useValue: data },
          { provide: AccountService, useValue: accountService },
          { provide: OrganizationService, useValue: organizationService },
          { provide: AuthService, useValue: authService },
          { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
          { provide: I18nService, useValue: i18n },
          { provide: DialogRef, useValue: dRef },
          { provide: ToastService, useValue: mock<ToastService>() },
          { provide: KeyService, useValue: mock<KeyService>() },
          { provide: DialogService, useValue: mock<DialogService>() },
          { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
          { provide: EncryptService, useValue: mock<EncryptService>() },
          // Only AutoConfirmPolicy's component injects these, but providing them unconditionally
          // is harmless for every other policy rendered through this same helper.
          { provide: PolicyService, useValue: policyService },
          {
            provide: AutomaticUserConfirmationService,
            useValue: mock<AutomaticUserConfirmationService>(),
          },
          { provide: Router, useValue: router },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const fx = TestBed.createComponent(MultiStepPolicyEditDialogComponent);
      fx.detectChanges();
      await fx.whenStable();
      // The async ngAfterViewInit chain (load() -> createComponent()) resolves signal writes
      // (loading, policyComponent, etc.) after the initial detectChanges() call - a second pass
      // is needed to render those updates into the DOM.
      fx.detectChanges();
      return { fixture: fx, component: fx.componentInstance as any };
    }

    it("renders MasterPasswordPolicyComponent with the policy name as the title and an On/Off badge", async () => {
      const { fixture, component } = await setupRealPolicy(new MasterPasswordPolicy());

      expect(component.policyComponent()).toBeInstanceOf(MasterPasswordPolicyComponent);
      expect(component.dialogTitle()).toBe("masterPassPolicyTitle");
      expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();
    });

    it("renders OrganizationDataOwnershipPolicyComponent with the policy name as the title and an On/Off badge", async () => {
      const { fixture, component } = await setupRealPolicy(new OrganizationDataOwnershipPolicy());

      expect(component.policyComponent()).toBeInstanceOf(OrganizationDataOwnershipPolicyComponent);
      expect(component.dialogTitle()).toBe("centralizeDataOwnership");
      expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();
    });

    describe("AutoConfirmPolicy", () => {
      // Regression test: AutoConfirmPolicyEditComponent previously threw NG0951 ("Child query
      // result is required but no value is available") when advancing to step 1, because the
      // inherited viewChild.required(...) queries for #step1Title/#step1Content/#step1Footer must
      // resolve against whichever concrete component's view is actually rendered.
      it("renders AutoConfirmPolicyEditComponent and can advance through both steps without throwing", async () => {
        const { fixture, component } = await setupRealPolicy(new AutoConfirmPolicy());

        expect(component.policyComponent()).toBeInstanceOf(AutoConfirmPolicyEditComponent);
        expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();

        component.currentStep.set(1);
        expect(() => fixture.detectChanges()).not.toThrow();
        // Step 1's own titleContent takes over from the generic dialogTitle() once rendered.
        expect(component.dialogTitle()).toBeUndefined();
      });
    });
  });
});
