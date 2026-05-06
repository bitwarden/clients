import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule, UntypedFormGroup } from "@angular/forms";
import { MockProxy, mock } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
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
    configService.getFeatureFlag.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: AccountService, useValue: mock<AccountService>() },
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
});
