import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  UntypedFormGroup,
  Validators,
} from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyCategory } from "./pipes/policy-category";
import { PolicyEditDialogComponent, PolicyEditDialogData } from "./policy-edit-dialog.component";

const ORG_ID = "org1" as OrganizationId;

const dialogData: PolicyEditDialogData = {
  policy: {
    name: "testPolicy",
    description: "testDesc",
    type: PolicyType.ResetPassword,
    component: class {} as any,
    showDescription: true,
    display$: () => of(true),
    category: PolicyCategory.DataControl,
    priority: 1,
  } as BasePolicyEditDefinition,
  organization: { id: ORG_ID } as Organization,
};

describe("PolicyEditDialogComponent", () => {
  let component: PolicyEditDialogComponent;
  let fixture: ComponentFixture<PolicyEditDialogComponent>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;

  beforeEach(async () => {
    policyApiService = mock<PolicyApiServiceAbstraction>();
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = NEVER;

    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(NEVER);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
        { provide: ConfigService, useValue: configService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PolicyEditDialogComponent);
    component = fixture.componentInstance;
    // Intentionally skip detectChanges() to avoid triggering ngAfterViewInit,
    // which calls load() and policyFormRef() in the real component.
  });

  /**
   * Simulates running ngAfterViewInit with a real FormGroup as the child policy
   * component's data. Overrides the policyFormRef viewChild signal so we can
   * inject our own data FormGroup without rendering the real child component.
   */
  async function runNgAfterViewInitWith(
    enabledForm: FormControl<boolean | null>,
    dataGroup: UntypedFormGroup | undefined,
    existingPolicy: PolicyResponse,
  ): Promise<void> {
    policyApiService.getPolicy.mockResolvedValue(existingPolicy);

    const mockComponentRef = {
      instance: { enabled: enabledForm, data: dataGroup } as Partial<BasePolicyEditComponent>,
      setInput: jest.fn(),
    };

    (component as any).policyFormRef = jest
      .fn()
      .mockReturnValue({ createComponent: jest.fn().mockReturnValue(mockComponentRef) });

    await component.ngAfterViewInit();
  }

  describe("saveDisabled", () => {
    it("is false when policy enabled field has changed", async () => {
      const enabledForm = new FormControl(false);

      await runNgAfterViewInitWith(
        enabledForm,
        undefined,
        new PolicyResponse({ Enabled: true, CanToggleState: true }),
      );

      enabledForm.setValue(false);

      expect(component.saveDisabled()).toBe(false);
    });

    it("is false when policy data field has changed", async () => {
      const fb = new FormBuilder();
      const dataGroup = fb.group({ autoEnrollEnabled: [{ value: false, disabled: true }] });
      await runNgAfterViewInitWith(
        new FormControl(true),
        dataGroup,
        new PolicyResponse({
          Enabled: true,
          CanToggleState: true,
          Data: { autoEnrollEnabled: false },
        }),
      );

      dataGroup.controls.autoEnrollEnabled.setValue(true);

      expect(component.saveDisabled()).toBe(false);
    });

    it("is true if neither enabled field nor policy data have changed", async () => {
      const fb = new FormBuilder();
      const dataGroup = fb.group({ autoEnrollEnabled: [{ value: false, disabled: true }] });
      await runNgAfterViewInitWith(
        new FormControl(true),
        dataGroup,
        new PolicyResponse({
          Enabled: true,
          CanToggleState: true,
          Data: { autoEnrollEnabled: false },
        }),
      );

      expect(component.saveDisabled()).toBe(true);
    });

    it("is true when form status is INVALID", async () => {
      const fb = new FormBuilder();
      const dataGroup = fb.group({ autoEnrollEnabled: [null, Validators.required] });

      await runNgAfterViewInitWith(
        new FormControl(true),
        dataGroup,
        new PolicyResponse({
          Enabled: true,
          CanToggleState: true,
          Data: { autoEnrollEnabled: false },
        }),
      );

      // Trigger a status change: INVALID → VALID → INVALID
      dataGroup.controls.autoEnrollEnabled.setValue("value");
      dataGroup.controls.autoEnrollEnabled.setValue(null);

      expect(component.saveDisabled()).toBe(true);
    });

    it("is true when canToggleState is false regardless of form validity", async () => {
      const fb = new FormBuilder();
      const dataGroup = fb.group({ autoEnrollEnabled: [null, Validators.required] });

      await runNgAfterViewInitWith(
        new FormControl(true),
        dataGroup,
        new PolicyResponse({
          Enabled: true,
          CanToggleState: false,
          Data: { autoEnrollEnabled: false },
        }),
      );

      // Trigger a status change: INVALID → VALID
      dataGroup.controls.autoEnrollEnabled.setValue("value");

      expect(component.saveDisabled()).toBe(true);
    });
  });
});
