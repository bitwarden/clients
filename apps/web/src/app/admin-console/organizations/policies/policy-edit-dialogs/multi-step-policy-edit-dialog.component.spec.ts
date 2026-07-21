// bit-dialog uses IntersectionObserver, which isn't available in jsdom.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
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
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import {
  AutoConfirmPolicy,
  AutoConfirmPolicyEditComponent,
  AutoConfirmPolicyEditV2Component,
} from "../policy-edit-definitions/auto-confirm-policy.component";
import { MasterPasswordPolicyV2Component } from "../policy-edit-definitions/master-password-v2.component";
import {
  MasterPasswordPolicy,
  MasterPasswordPolicyComponent,
} from "../policy-edit-definitions/master-password.component";
import { OrganizationDataOwnershipPolicyV2Component } from "../policy-edit-definitions/organization-data-ownership-v2.component";
import {
  OrganizationDataOwnershipPolicy,
  OrganizationDataOwnershipPolicyComponent,
} from "../policy-edit-definitions/organization-data-ownership.component";
import { PolicyEditDialogData, PolicyEditDialogResult } from "../policy-edit-dialog.component";

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
    organizationId: "org-1",
  };

  beforeEach(async () => {
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockReturnValue("translated");
    dialogRef = mock<DialogRef<PolicyEditDialogResult>>();
    policyComponent = mock<BasePolicyEditComponent>();
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

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
        { provide: ConfigService, useValue: configService },
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

  describe("isV2 (drawer/flag gating)", () => {
    @Component({
      selector: "test-v1-policy",
      template: "v1",
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class TestV1PolicyComponent extends BasePolicyEditComponent {}

    @Component({
      selector: "test-v2-policy",
      template: "v2",
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class TestV2PolicyComponent extends BasePolicyEditComponent {}

    async function setup(options: {
      isDrawer?: boolean;
      withV2: boolean;
      showDescription?: boolean;
      v2ShowDescription?: boolean;
      v2Description?: string;
    }) {
      const policy: BasePolicyEditDefinition = {
        name: "testPolicy",
        description: "testDesc",
        type: 0,
        category: "data-controls",
        priority: 0,
        component: TestV1PolicyComponent,
        showDescription: options.showDescription ?? false,
        showEnabledBadge: false,
        display$: () => of(true),
        ...(options.withV2
          ? {
              v2: {
                component: TestV2PolicyComponent,
                ...(options.v2ShowDescription !== undefined
                  ? { showDescription: options.v2ShowDescription }
                  : {}),
                ...(options.v2Description !== undefined
                  ? { description: options.v2Description }
                  : {}),
              },
            }
          : {}),
      } as BasePolicyEditDefinition;

      const data: PolicyEditDialogData = {
        policy,
        organization: { id: "org-1" } as Organization,
      };

      const i18n = mock<I18nService>();
      i18n.t.mockImplementation((key: any) => key);
      const policyApiService = mock<PolicyApiServiceAbstraction>();
      policyApiService.getPolicy.mockResolvedValue(new PolicyResponse({ Enabled: false }));
      const accountService = mock<AccountService>();
      accountService.activeAccount$ = of(null);
      const organizationService = mock<OrganizationService>();
      organizationService.organizations$.mockReturnValue(of([]));
      const dRef = mock<DialogRef<PolicyEditDialogResult>>();
      (dRef as any).isDrawer = options.isDrawer ?? false;
      const configService = mock<ConfigService>();
      configService.getFeatureFlag$.mockReturnValue(of(false));

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ReactiveFormsModule],
        providers: [
          { provide: DIALOG_DATA, useValue: data },
          { provide: AccountService, useValue: accountService },
          { provide: OrganizationService, useValue: organizationService },
          { provide: AuthService, useValue: mock<AuthService>() },
          { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
          { provide: I18nService, useValue: i18n },
          { provide: DialogRef, useValue: dRef },
          { provide: ToastService, useValue: mock<ToastService>() },
          { provide: KeyService, useValue: mock<KeyService>() },
          { provide: DialogService, useValue: mock<DialogService>() },
          { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
          { provide: ConfigService, useValue: configService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const fx = TestBed.createComponent(MultiStepPolicyEditDialogComponent);
      return { fixture: fx, component: fx.componentInstance as any };
    }

    it("is false when opened as a modal, even if the policy defines a v2 component", async () => {
      const { component } = await setup({ isDrawer: false, withV2: true });

      expect(component.isV2()).toBe(false);
    });

    it("is false when opened as a drawer but the policy has no v2 component", async () => {
      const { component } = await setup({ isDrawer: true, withV2: false });

      expect(component.isV2()).toBe(false);
    });

    it("is true only when opened as a drawer AND the policy defines a v2 component", async () => {
      const { component } = await setup({ isDrawer: true, withV2: true });

      expect(component.isV2()).toBe(true);
    });

    it("keeps the 'Edit policy' title and loads the standard component when isV2 is false, even with a v2 component defined", async () => {
      const { fixture, component } = await setup({ isDrawer: false, withV2: true });

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.dialogTitle()).toBe("editPolicy");
      expect(component.policyComponent()).toBeInstanceOf(TestV1PolicyComponent);
    });

    it("uses the policy name as the title and loads the v2 component when isV2 is true", async () => {
      const { fixture, component } = await setup({ isDrawer: true, withV2: true });

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.dialogTitle()).toBe("testPolicy");
      expect(component.policyComponent()).toBeInstanceOf(TestV2PolicyComponent);
    });

    describe("showDescription/descriptionKey (v2-only overrides shouldn't hide the v1 description)", () => {
      // Regression test: a v2 component that renders its own description used to be able to hide
      // the description from the v1 modal too, because the dialog read the plain `showDescription`
      // field which was being set to `false` unconditionally by policies like MasterPasswordPolicy.
      it("uses the top-level showDescription/description when isV2 is false, ignoring v2's override", async () => {
        const { component } = await setup({
          isDrawer: false,
          withV2: true,
          showDescription: true,
          v2ShowDescription: false,
          v2Description: "v2Desc",
        });

        expect(component.showDescription()).toBe(true);
        expect(component.descriptionKey()).toBe("testDesc");
      });

      it("uses v2's showDescription/description override when isV2 is true", async () => {
        const { component } = await setup({
          isDrawer: true,
          withV2: true,
          showDescription: true,
          v2ShowDescription: false,
          v2Description: "v2Desc",
        });

        expect(component.showDescription()).toBe(false);
        expect(component.descriptionKey()).toBe("v2Desc");
      });

      it("falls back to the top-level showDescription/description when isV2 is true but v2 doesn't override them", async () => {
        const { component } = await setup({
          isDrawer: true,
          withV2: true,
          showDescription: true,
        });

        expect(component.showDescription()).toBe(true);
        expect(component.descriptionKey()).toBe("testDesc");
      });
    });
  });

  /**
   * End-to-end regression tests for the two production policies that actually use this dialog
   * for both modal and drawer rendering (MasterPasswordPolicy and OrganizationDataOwnershipPolicy).
   * These render the REAL v1/v2 components (not test doubles) through the REAL dialog, so they
   * catch the exact class of bug reported in PR review: v2-only design (badge, v2 component,
   * description) leaking into the modal when the `PolicyDrawers` flag is off.
   */
  describe("Real MasterPasswordPolicy / OrganizationDataOwnershipPolicy rendering (no v2 leak)", () => {
    async function setupRealPolicy(policy: BasePolicyEditDefinition, isDrawer: boolean) {
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
      (dRef as any).isDrawer = isDrawer;
      const configService = mock<ConfigService>();
      configService.getFeatureFlag$.mockReturnValue(of(isDrawer));
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
          { provide: ConfigService, useValue: configService },
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

    describe("MasterPasswordPolicy", () => {
      it("renders the v1 component, no badge, and the generic 'Edit policy' title when the flag is off (modal)", async () => {
        const { fixture, component } = await setupRealPolicy(new MasterPasswordPolicy(), false);

        expect(component.policyComponent()).toBeInstanceOf(MasterPasswordPolicyComponent);
        expect(component.policyComponent()).not.toBeInstanceOf(MasterPasswordPolicyV2Component);
        expect(component.dialogTitle()).toBe("editPolicy");
        expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
        // v1 has no inline description, so the dialog's own showDescription must stay on.
        expect(component.showDescription()).toBe(true);
        expect(component.descriptionKey()).toBe("masterPassPolicyDesc");
      });

      it("renders the v2 component, a badge, and the policy name as the title when the flag is on (drawer)", async () => {
        const { fixture, component } = await setupRealPolicy(new MasterPasswordPolicy(), true);

        expect(component.policyComponent()).toBeInstanceOf(MasterPasswordPolicyV2Component);
        expect(component.dialogTitle()).toBe("masterPassPolicyTitle");
        expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();
        // v2 renders its own description inline, so the dialog's own description must be hidden.
        expect(component.showDescription()).toBe(false);
      });
    });

    describe("OrganizationDataOwnershipPolicy", () => {
      it("renders the v1 component, no badge, and the generic 'Edit policy' title when the flag is off (modal)", async () => {
        const { fixture, component } = await setupRealPolicy(
          new OrganizationDataOwnershipPolicy(),
          false,
        );

        expect(component.policyComponent()).toBeInstanceOf(
          OrganizationDataOwnershipPolicyComponent,
        );
        expect(component.policyComponent()).not.toBeInstanceOf(
          OrganizationDataOwnershipPolicyV2Component,
        );
        expect(component.dialogTitle()).toBe("editPolicy");
        expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
      });

      it("renders the v2 component, a badge, and the policy name as the title when the flag is on (drawer)", async () => {
        const { fixture, component } = await setupRealPolicy(
          new OrganizationDataOwnershipPolicy(),
          true,
        );

        expect(component.policyComponent()).toBeInstanceOf(
          OrganizationDataOwnershipPolicyV2Component,
        );
        expect(component.dialogTitle()).toBe("centralizeDataOwnership");
        expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();
      });
    });

    describe("AutoConfirmPolicy", () => {
      // Regression test: AutoConfirmPolicyEditV2Component previously threw NG0951 ("Child query
      // result is required but no value is available") when advancing to step 1, because its
      // template didn't declare the #step1Title/#step1Content/#step1Footer refs that the
      // inherited viewChild.required(...) queries (declared on the v1 base class, but resolved
      // against whichever concrete component's view is actually rendered) require.
      it("renders the v1 component, no badge, and can render both steps when the flag is off (modal)", async () => {
        const { fixture, component } = await setupRealPolicy(new AutoConfirmPolicy(), false);

        expect(component.policyComponent()).toBeInstanceOf(AutoConfirmPolicyEditComponent);
        expect(component.policyComponent()).not.toBeInstanceOf(AutoConfirmPolicyEditV2Component);
        expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();

        component.currentStep.set(1);
        expect(() => fixture.detectChanges()).not.toThrow();
      });

      it("renders the v2 component, a badge, and can render both steps when the flag is on (drawer)", async () => {
        const { fixture, component } = await setupRealPolicy(new AutoConfirmPolicy(), true);

        expect(component.policyComponent()).toBeInstanceOf(AutoConfirmPolicyEditV2Component);
        expect(component.dialogTitle()).toBe("automaticUserConfirmation");
        expect(fixture.nativeElement.querySelector("[bitBadge]")).not.toBeNull();

        component.currentStep.set(1);
        expect(() => fixture.detectChanges()).not.toThrow();
        // Step 1's own titleContent takes over from the generic dialogTitle() once rendered.
        expect(component.dialogTitle()).toBeUndefined();
      });
    });
  });
});
