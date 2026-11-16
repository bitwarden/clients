import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import {
  AutotypeShortcutOption,
  DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  DesktopAutotypeGaPolicy,
  DesktopAutotypeGaPolicyComponent,
} from "./autotype-ga-policy.component";

jest.mock("@bitwarden/common/desktop-native/services/autotype-feature-flags", () => ({
  autotypeFeatureFlagState$: jest.fn(),
}));

describe("DesktopAutotypeGaPolicy", () => {
  const policy = new DesktopAutotypeGaPolicy();
  const org = {} as Organization;

  it("should have correct attributes", () => {
    expect(policy.name).toBe("desktopAppAutofillPolicyTitle");
    expect(policy.description).toBe("desktopAppAutofillPolicyDesc");
    expect(policy.type).toBe(PolicyType.AutotypeGaPolicy);
    expect(policy.component).toBe(DesktopAutotypeGaPolicyComponent);
    expect(policy.showDescription).toBe(false);
  });

  describe("display$", () => {
    let configService: MockProxy<ConfigService>;

    beforeEach(() => {
      configService = mock<ConfigService>();
      jest.mocked(autotypeFeatureFlagState$).mockReset();
    });

    it("displays when the resolved feature flag state is Ga", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Ga));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(autotypeFeatureFlagState$).toHaveBeenCalledWith(configService);
      expect(result).toBe(true);
    });

    it("does not display when the resolved feature flag state is Mvp", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Mvp));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(false);
    });

    it("does not display when the resolved feature flag state is Off", async () => {
      jest.mocked(autotypeFeatureFlagState$).mockReturnValue(of(AutotypeFeatureFlagState.Off));

      const result = await firstValueFrom(policy.display$(org, configService));

      expect(result).toBe(false);
    });
  });
});

describe("DesktopAutotypeGaPolicyComponent", () => {
  let component: DesktopAutotypeGaPolicyComponent;
  let fixture: ComponentFixture<DesktopAutotypeGaPolicyComponent>;

  const makePolicyResponse = (data: object | null, enabled = true) =>
    new PolicyStatusResponse({
      OrganizationId: "org1" as OrganizationId,
      Type: PolicyType.AutotypeGaPolicy,
      Enabled: enabled,
      Data: data,
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: AccountService, useValue: mockAccountServiceWith("user1" as UserId) },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopAutotypeGaPolicyComponent);
    fixture.componentRef.setInput("policy", new DesktopAutotypeGaPolicy());
    component = fixture.componentInstance;
  });

  const requestData = async () => (await component.buildRequest()).policy.data;

  it("saves the built-in shortcut when Default is selected", async () => {
    component.ngOnInit();
    component.enabled.setValue(true);

    expect(component["shortcutOption"].value).toBe(AutotypeShortcutOption.Default);
    expect(component["customShortcut"]()).toBeNull();
    expect(component.data.valid).toBe(true);
    expect(await requestData()).toEqual({
      shortcutOption: AutotypeShortcutOption.Default,
      defaultKeyboardShortcut: DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
    });
  });

  it("leaves an unsaved policy on Default with no shortcut", () => {
    fixture.componentRef.setInput("policyResponse", makePolicyResponse(null, false));
    component.ngOnInit();
    const loaded = component.data.getRawValue();

    expect(loaded).toEqual({
      shortcutOption: AutotypeShortcutOption.Default,
      defaultKeyboardShortcut: null,
    });

    component["shortcutOption"].setValue(AutotypeShortcutOption.Custom);
    component["shortcutOption"].setValue(AutotypeShortcutOption.Default);

    expect(component.data.getRawValue()).toEqual(loaded);
  });

  it("loads older or invalid saved data without changing it or throwing", () => {
    const response = makePolicyResponse({});
    fixture.componentRef.setInput("policyResponse", response);
    component.ngOnInit();

    expect(component["shortcutOption"].value).toBe(AutotypeShortcutOption.Default);
    expect(component.data.valid).toBe(true);
    expect(response.data).toEqual({});

    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse({
        shortcutOption: AutotypeShortcutOption.Custom,
        defaultKeyboardShortcut: "Ctrl+K",
      }),
    );

    expect(() => {
      component.ngOnInit();
      fixture.detectChanges();
    }).not.toThrow();
    expect(component["shortcutOption"].value).toBe(AutotypeShortcutOption.Custom);
    expect(component["defaultKeyboardShortcut"].value).toBeNull();
  });

  it("loads a saved custom shortcut and marks the form dirty only when it changes", async () => {
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse({
        shortcutOption: AutotypeShortcutOption.Custom,
        defaultKeyboardShortcut: ["Control", "Super", "K"],
      }),
    );

    component.ngOnInit();

    expect(component["shortcutOption"].value).toBe(AutotypeShortcutOption.Custom);
    expect(component["customShortcut"]()).toEqual(["Control", "Super", "K"]);
    expect(component.data.dirty).toBe(false);
    expect(await requestData()).toEqual({
      shortcutOption: AutotypeShortcutOption.Custom,
      defaultKeyboardShortcut: ["Control", "Super", "K"],
    });

    component["onCustomShortcut"](["Alt", "Q"]);

    expect(component.data.dirty).toBe(true);
  });

  it("saves a custom shortcut and keeps it when switching back to Default", async () => {
    component.ngOnInit();
    component.enabled.setValue(true);
    component["shortcutOption"].setValue(AutotypeShortcutOption.Custom);
    expect(component.data.valid).toBe(false);

    component["onCustomShortcut"](["Alt", "Q"]);

    expect(component.data.valid).toBe(true);
    expect(await requestData()).toEqual({
      shortcutOption: AutotypeShortcutOption.Custom,
      defaultKeyboardShortcut: ["Alt", "Q"],
    });

    component["shortcutOption"].setValue(AutotypeShortcutOption.Default);

    expect(await requestData()).toEqual({
      shortcutOption: AutotypeShortcutOption.Default,
      defaultKeyboardShortcut: DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
    });

    component["shortcutOption"].setValue(AutotypeShortcutOption.Custom);

    expect(component["customShortcut"]()).toEqual(["Alt", "Q"]);
    expect(component.data.valid).toBe(true);

    component["onCustomShortcut"](["Control", "Alt", "Super", "K"]);

    expect(component.data.valid).toBe(false);
  });

  it("saves Custom with no shortcut when the policy is turned off", async () => {
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(
        {
          shortcutOption: AutotypeShortcutOption.Default,
          defaultKeyboardShortcut: null,
        },
        true,
      ),
    );

    component.ngOnInit();
    component["shortcutOption"].setValue(AutotypeShortcutOption.Custom);

    expect(component["customShortcut"]()).toBeNull();
    expect(component.data.valid).toBe(false);

    component.enabled.setValue(false);

    expect(component.data.valid).toBe(true);
    expect(await requestData()).toEqual({
      shortcutOption: AutotypeShortcutOption.Custom,
      defaultKeyboardShortcut: null,
    });

    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(
        {
          shortcutOption: AutotypeShortcutOption.Custom,
          defaultKeyboardShortcut: null,
        },
        false,
      ),
    );
    component.ngOnInit();

    expect(component["shortcutOption"].value).toBe(AutotypeShortcutOption.Custom);
    expect(component["customShortcut"]()).toBeNull();
    expect(component.enabled.value).toBe(false);
  });
});
