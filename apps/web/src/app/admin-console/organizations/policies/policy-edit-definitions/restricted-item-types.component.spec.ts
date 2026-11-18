import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { KeyService } from "@bitwarden/key-management";

import {
  ManageItemTypesPolicy,
  RestrictedItemTypesPolicyComponent,
  RestrictedItemTypesPolicy,
} from "./restricted-item-types.component";

describe("restricted item types policy definitions", () => {
  const organization = mock<Organization>();

  function configWithFlag(enabled: boolean): ConfigService {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(
      (flag) => of(flag === FeatureFlag.PM32009NewItemTypes ? enabled : false) as any,
    );
    return configService;
  }

  it("shows only the legacy policy when the new item types flag is off", async () => {
    const configService = configWithFlag(false);

    expect(
      await firstValueFrom(new RestrictedItemTypesPolicy().display$(organization, configService)),
    ).toBe(true);
    expect(
      await firstValueFrom(new ManageItemTypesPolicy().display$(organization, configService)),
    ).toBe(false);
  });

  it("shows only the manage item types policy when the new item types flag is on", async () => {
    const configService = configWithFlag(true);

    expect(
      await firstValueFrom(new RestrictedItemTypesPolicy().display$(organization, configService)),
    ).toBe(false);
    expect(
      await firstValueFrom(new ManageItemTypesPolicy().display$(organization, configService)),
    ).toBe(true);
  });

  it("edits the same policy type", () => {
    expect(new ManageItemTypesPolicy().type).toBe(new RestrictedItemTypesPolicy().type);
  });
});

describe("RestrictedItemTypesPolicyComponent data", () => {
  let fixture: ComponentFixture<RestrictedItemTypesPolicyComponent>;

  async function setup(response: Partial<PolicyStatusResponse>) {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true) as any);
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject({ id: "user" } as any);

    await TestBed.configureTestingModule({
      imports: [RestrictedItemTypesPolicyComponent],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: PolicyService, useValue: policyService },
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RestrictedItemTypesPolicyComponent);
    fixture.componentRef.setInput("policyResponse", {
      type: PolicyType.RestrictedItemTypes,
      ...response,
    });
    fixture.detectChanges();
    return fixture.componentInstance as any;
  }

  it("saves unchecked types as restrictedTypes", async () => {
    const component = await setup({ enabled: true, data: { restrictedTypes: [] } });
    component.data.controls[CipherType.Card].setValue(false);
    component.data.controls[CipherType.Identity].setValue(false);

    expect(component.buildRequestData()).toEqual({
      restrictedTypes: [CipherType.Card, CipherType.Identity],
    });
  });

  it("saves an empty list when everything is allowed", async () => {
    const component = await setup({ enabled: true, data: { restrictedTypes: [] } });

    expect(component.buildRequestData()).toEqual({ restrictedTypes: [] });
  });

  it("loads a legacy enabled policy as Card restricted and round-trips it", async () => {
    const component = await setup({ enabled: true, data: null });

    expect(component.data.controls[CipherType.Card].value).toBe(false);
    expect(component.buildRequestData()).toEqual({ restrictedTypes: [CipherType.Card] });
  });

  it("loads a never-enabled policy with everything allowed", async () => {
    const component = await setup({ enabled: false, data: null });

    expect(component.buildRequestData()).toEqual({ restrictedTypes: [] });
  });

  it("keeps stored selections while the policy is disabled", async () => {
    const component = await setup({
      enabled: false,
      data: { restrictedTypes: [CipherType.Passport] },
    });

    expect(component.buildRequestData()).toEqual({ restrictedTypes: [CipherType.Passport] });
  });

  it("carries over restricted types the UI does not manage", async () => {
    const component = await setup({
      enabled: true,
      data: { restrictedTypes: [CipherType.Card, CipherType.SecureNote] },
    });
    component.data.controls[CipherType.Card].setValue(true);

    expect(component.buildRequestData()).toEqual({ restrictedTypes: [CipherType.SecureNote] });
  });
});
