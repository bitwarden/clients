import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { MasterPasswordPolicyComponent } from "./master-password.component";

describe("MasterPasswordPolicyComponent", () => {
  let component: MasterPasswordPolicyComponent;
  let fixture: ComponentFixture<MasterPasswordPolicyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MasterPasswordPolicyComponent);
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
