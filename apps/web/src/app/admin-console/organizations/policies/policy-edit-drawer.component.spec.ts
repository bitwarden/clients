// bit-dialog uses IntersectionObserver, which isn't available in jsdom.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { NEVER, Observable, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DEFAULT_FILL_ASSIST_RULES_URL } from "@bitwarden/common/autofill/constants";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import {
  FillAssistPolicy,
  OrganizationUserNotificationPolicy,
  PasswordGeneratorPolicy,
  ResetPasswordPolicy,
  SendControlsPolicy,
} from "./policy-edit-definitions";
import { PolicyEditDialogData, PolicyEditDrawerComponent } from "./policy-edit-drawer.component";

describe("PolicyEditDrawerComponent", () => {
  /**
   * Renders the REAL policy component through the REAL drawer, so that the Save button state
   * reflects each policy's actual form defaults and data transformations.
   */
  async function setup(
    policy: BasePolicyEditDefinition,
    policyResponse: PolicyResponse,
    featureFlag$: Observable<boolean> = of(false),
  ) {
    const data: PolicyEditDialogData = {
      policy,
      organization: { id: "org-1" } as Organization,
    };

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: any) => key);
    const policyApiService = mock<PolicyApiServiceAbstraction>();
    policyApiService.getPolicy.mockResolvedValue(policyResponse);
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1", email: "user@example.com" } as any);
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([{ id: "org-1" } as any]));
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(
      of([{ type: PolicyType.SingleOrg, enabled: true } as any]),
    );
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(featureFlag$);
    const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
    orgDomainApiService.getAllByOrgId.mockResolvedValue([]);
    const environmentService = mock<EnvironmentService>();
    environmentService.environment$ = of({ isCloud: () => true } as any);
    const router = mock<Router>();
    // DrawerService reads router.url synchronously at construction time.
    (router as any).url = "/";
    (router as any).events = NEVER;

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AuthService, useValue: authService },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
        { provide: PolicyService, useValue: policyService },
        { provide: ConfigService, useValue: configService },
        { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
        { provide: Router, useValue: router },
        { provide: Vfo1TerminologyService, useValue: { enabled: () => false } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(PolicyEditDrawerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    return {
      fixture,
      saveDisabled: (): boolean => component.saveDisabled(),
      policyComponent: () => component.policyComponent(),
    };
  }

  const neverSaved = () => new PolicyResponse({ Enabled: false });

  it.each([
    ["PasswordGeneratorPolicy", () => new PasswordGeneratorPolicy()],
    ["ResetPasswordPolicy", () => new ResetPasswordPolicy()],
    ["FillAssistPolicy", () => new FillAssistPolicy()],
  ])("disables Save for a never-saved %s until it is edited", async (_name, createPolicy) => {
    const { saveDisabled, policyComponent } = await setup(createPolicy(), neverSaved());

    expect(saveDisabled()).toBe(true);

    policyComponent().enabled.setValue(true);
    expect(saveDisabled()).toBe(false);

    policyComponent().enabled.setValue(false);
    expect(saveDisabled()).toBe(true);
  });

  it("disables Save for a never-saved OrganizationUserNotificationPolicy until it is edited", async () => {
    const { saveDisabled, policyComponent } = await setup(
      new OrganizationUserNotificationPolicy(),
      neverSaved(),
    );

    expect(saveDisabled()).toBe(true);

    // Turning the policy on makes the description required.
    policyComponent().enabled.setValue(true);
    policyComponent().data.controls.description.setValue("Welcome");
    expect(saveDisabled()).toBe(false);
  });

  it.each([true, false])(
    "disables Save for a never-saved SendControlsPolicy with temporary item sharing %s",
    async (flagEnabled) => {
      const { saveDisabled, policyComponent } = await setup(
        new SendControlsPolicy(),
        neverSaved(),
        of(flagEnabled),
      );

      expect(saveDisabled()).toBe(true);

      policyComponent().data.controls.disableHideEmail.setValue(true);
      expect(saveDisabled()).toBe(false);
    },
  );

  it("disables Save for a saved FillAssistPolicy whose stored URL is transformed for display", async () => {
    const { saveDisabled, policyComponent } = await setup(
      new FillAssistPolicy(),
      new PolicyResponse({ Enabled: true, Data: { rulesUrl: "https://rules.example.com" } }),
    );

    expect(policyComponent().data.controls.rulesUrl.value).toBe("rules.example.com");
    expect(saveDisabled()).toBe(true);

    policyComponent().data.controls.rulesUrl.setValue("other.example.com");
    expect(saveDisabled()).toBe(false);
  });

  it("disables Save for a saved FillAssistPolicy using the default rules", async () => {
    const { saveDisabled } = await setup(
      new FillAssistPolicy(),
      new PolicyResponse({ Enabled: true, Data: { rulesUrl: DEFAULT_FILL_ASSIST_RULES_URL } }),
    );

    expect(saveDisabled()).toBe(true);
  });

  it("keeps Save disabled when the server says the policy cannot be toggled", async () => {
    const { saveDisabled, policyComponent } = await setup(
      new ResetPasswordPolicy(),
      new PolicyResponse({ Enabled: false, CanToggleState: false }),
    );

    policyComponent().enabled.setValue(true);

    expect(saveDisabled()).toBe(true);
  });
});
