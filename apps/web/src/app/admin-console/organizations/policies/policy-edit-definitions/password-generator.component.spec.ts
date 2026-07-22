import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { KeyService } from "@bitwarden/key-management";

import { PasswordGeneratorPolicyV2Component } from "./password-generator-v2.component";
import {
  PasswordGeneratorPolicy,
  PasswordGeneratorPolicyComponent,
} from "./password-generator.component";

function commonProviders(i18nService: MockProxy<I18nService>) {
  return [
    { provide: I18nService, useValue: i18nService },
    { provide: OrganizationService, useValue: mock<OrganizationService>() },
    { provide: AccountService, useValue: mock<AccountService>() },
    { provide: KeyService, useValue: mock<KeyService>() },
    { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
  ];
}

describe("PasswordGeneratorPolicy", () => {
  const policy = new PasswordGeneratorPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toBe("passwordGenerator");
    expect(policy.description).toBe("passwordGeneratorPolicyDesc");
    expect(policy.v2?.description).toBe("passwordGeneratorPolicyDescV2");
    expect(policy.v2?.showDescription).toBe(false);
    expect(policy.type).toBe(PolicyType.PasswordGenerator);
    expect(policy.component).toBe(PasswordGeneratorPolicyComponent);
  });

  describe("v2", () => {
    it("should point to PasswordGeneratorPolicyV2Component", () => {
      expect(policy.v2?.component).toBe(PasswordGeneratorPolicyV2Component);
    });
  });
});

describe("PasswordGeneratorPolicyComponent", () => {
  let component: PasswordGeneratorPolicyComponent;
  let fixture: ComponentFixture<PasswordGeneratorPolicyComponent>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: commonProviders(i18nService),
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordGeneratorPolicyComponent);
    component = fixture.componentInstance;
  });

  it("shows both password and passphrase sections by default", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    expect(showPassword).toBe(true);
    expect(showPassphrase).toBe(true);
  });

  it("shows only the password section when overridePasswordType is 'password'", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    component.data.patchValue({ overridePasswordType: "password" });

    expect(showPassword).toBe(true);
    expect(showPassphrase).toBe(false);
  });

  it("shows only the passphrase section when overridePasswordType is 'passphrase'", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    component.data.patchValue({ overridePasswordType: "passphrase" });

    expect(showPassword).toBe(false);
    expect(showPassphrase).toBe(true);
  });

  it("rejects a minLength below the allowed minimum", () => {
    component.data.patchValue({ minLength: component["minLengthMin"] - 1 });

    expect(component.data.get("minLength")?.hasError("min")).toBe(true);
  });

  it("accepts a minLength within the allowed range", () => {
    component.data.patchValue({ minLength: component["minLengthMin"] });

    expect(component.data.get("minLength")?.valid).toBe(true);
  });
});

// PasswordGeneratorPolicyV2Component is used in place of PasswordGeneratorPolicyComponent (above)
// when the PolicyDrawers feature flag is enabled.
describe("PasswordGeneratorPolicyV2Component", () => {
  let component: PasswordGeneratorPolicyV2Component;
  let fixture: ComponentFixture<PasswordGeneratorPolicyV2Component>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: commonProviders(i18nService),
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordGeneratorPolicyV2Component);
    component = fixture.componentInstance;
  });

  it("shows both password and passphrase sections by default", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    expect(showPassword).toBe(true);
    expect(showPassphrase).toBe(true);
  });

  it("shows only the password section when overridePasswordType is 'password'", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    component.data.patchValue({ overridePasswordType: "password" });

    expect(showPassword).toBe(true);
    expect(showPassphrase).toBe(false);
  });

  it("shows only the passphrase section when overridePasswordType is 'passphrase'", () => {
    let showPassword: boolean | undefined;
    let showPassphrase: boolean | undefined;
    component.showPasswordPolicies$.subscribe((v) => (showPassword = v));
    component.showPassphrasePolicies$.subscribe((v) => (showPassphrase = v));

    component.data.patchValue({ overridePasswordType: "passphrase" });

    expect(showPassword).toBe(false);
    expect(showPassphrase).toBe(true);
  });

  it("rejects a minLength below the allowed minimum", () => {
    component.data.patchValue({ minLength: component["minLengthMin"] - 1 });

    expect(component.data.get("minLength")?.hasError("min")).toBe(true);
  });

  it("accepts a minLength within the allowed range", () => {
    component.data.patchValue({ minLength: component["minLengthMin"] });

    expect(component.data.get("minLength")?.valid).toBe(true);
  });

  it("builds overridePasswordTypeOptions with password and passphrase choices", () => {
    expect(component.overridePasswordTypeOptions.map((o) => o.value)).toEqual([
      null,
      "password",
      "passphrase",
    ]);
  });
});
