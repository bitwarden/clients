import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

import { MasterPasswordPolicyV2Component } from "./master-password-v2.component";
import { MasterPasswordPolicy, MasterPasswordPolicyComponent } from "./master-password.component";

describe("MasterPasswordPolicy", () => {
  const policy = new MasterPasswordPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toEqual("masterPassPolicyTitle");
    expect(policy.description).toEqual("masterPassPolicyDesc");
    expect(policy.component).toEqual(MasterPasswordPolicyComponent);
    expect(policy.v2?.component).toEqual(MasterPasswordPolicyV2Component);
  });

  it("shows the top-level description for v1 (MasterPasswordPolicyComponent doesn't render its own)", () => {
    expect(policy.showDescription).toBe(true);
  });

  it("hides the dialog's description for v2 (MasterPasswordPolicyV2Component renders its own)", () => {
    expect(policy.v2?.showDescription).toBe(false);
  });
});

// MultiStepPolicyEditDialogComponent renders MasterPasswordPolicyV2Component only when the
// dialog is opened as a drawer (PolicyDrawers flag on); otherwise it renders
// MasterPasswordPolicyComponent (below). See multi-step-policy-edit-dialog.component.spec.ts for
// coverage of that gating.
describe("MasterPasswordPolicyV2Component", () => {
  let component: MasterPasswordPolicyV2Component;
  let fixture: ComponentFixture<MasterPasswordPolicyV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterPasswordPolicyV2Component);
    component = fixture.componentInstance;
  });

  it("should accept minimum password length of 12", () => {
    component.data.patchValue({ minLength: 12 });

    expect(component.data.get("minLength")?.valid).toBe(true);
  });

  it("should accept maximum password length of 128", () => {
    component.data.patchValue({ minLength: 128 });

    expect(component.data.get("minLength")?.valid).toBe(true);
  });

  it("should reject password length below minimum", () => {
    component.data.patchValue({ minLength: 11 });

    expect(component.data.get("minLength")?.hasError("min")).toBe(true);
  });

  it("should reject password length above maximum", () => {
    component.data.patchValue({ minLength: 129 });

    expect(component.data.get("minLength")?.hasError("max")).toBe(true);
  });

  it("should use correct minimum from Utils", () => {
    expect(component.MinPasswordLength).toBe(Utils.minimumPasswordLength);
    expect(component.MinPasswordLength).toBe(12);
  });

  it("should use correct maximum from Utils", () => {
    expect(component.MaxPasswordLength).toBe(Utils.maximumPasswordLength);
    expect(component.MaxPasswordLength).toBe(128);
  });

  it("should have password scores from 0 to 4", () => {
    const scores = component.passwordScores.filter((s) => s.value !== null).map((s) => s.value);

    expect(scores).toEqual([0, 1, 2, 3, 4]);
  });
});
