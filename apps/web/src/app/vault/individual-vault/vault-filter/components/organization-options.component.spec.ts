import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { OrganizationFilter } from "@bitwarden/vault";

import { OrganizationUserResetPasswordService } from "../../../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { LinkSsoService } from "../../../../auth/core/services";
import { OptionsInput } from "../shared/components/vault-filter-section.component";

import { OrganizationOptionsComponent } from "./organization-options.component";

const userId = "user-id" as UserId;
const orgId = "org-id" as OrganizationId;

const buildOrg = (overrides: Partial<Organization> = {}) =>
  Object.assign(new Organization(), {
    id: orgId,
    name: "Acme",
    userId,
    usePolicies: true,
    useResetPassword: true,
    hasPublicAndPrivateKeys: true,
    resetPasswordEnrolled: false,
    useSso: false,
    identifier: "acme",
    ssoBound: false,
    userIsClaimedByOrganization: false,
    ...overrides,
  });

const resetPasswordPolicy = (overrides: Partial<Policy> = {}) =>
  Object.assign(new Policy(), {
    organizationId: orgId,
    type: PolicyType.ResetPassword,
    enabled: true,
    data: { autoEnrollEnabled: false },
    ...overrides,
  });

@Component({ template: "", changeDetection: ChangeDetectionStrategy.OnPush })
class DummyComponent {}

const masterPasswordUser = { hasMasterPassword: true } as UserDecryptionOptions;

describe("OrganizationOptionsComponent", () => {
  let fixture: ComponentFixture<OrganizationOptionsComponent>;

  let organizations$: BehaviorSubject<Organization[]>;
  let policies$: BehaviorSubject<Policy[]>;
  let decryptionOptions$: BehaviorSubject<UserDecryptionOptions>;

  const organizationService = mock<OrganizationService>();
  const policyService = mock<PolicyService>();
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const dialogService = mock<DialogService>();
  const validationService = mock<ValidationService>();
  const accountService = mock<AccountService>();

  const setup = async (optionsInput?: Observable<OrganizationFilter>) => {
    const providers = [
      { provide: OrganizationService, useValue: organizationService },
      { provide: PolicyService, useValue: policyService },
      { provide: UserDecryptionOptionsServiceAbstraction, useValue: userDecryptionOptionsService },
      { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
      { provide: DialogService, useValue: dialogService },
      { provide: ValidationService, useValue: validationService },
      { provide: AccountService, useValue: accountService },
      { provide: I18nService, useValue: { t: (key: string) => key } },
      { provide: ApiService, useValue: mock<ApiService>() },
      { provide: SyncService, useValue: mock<SyncService>() },
      { provide: LogService, useValue: mock<LogService>() },
      { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
      {
        provide: OrganizationUserResetPasswordService,
        useValue: mock<OrganizationUserResetPasswordService>(),
      },
      { provide: UserVerificationService, useValue: mock<UserVerificationService>() },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: KeyService, useValue: mock<KeyService>() },
      { provide: LinkSsoService, useValue: mock<LinkSsoService>() },
      { provide: SsoLoginServiceAbstraction, useValue: mock<SsoLoginServiceAbstraction>() },
      provideRouter([
        { path: "vault", component: DummyComponent },
        { path: "vault/:vaultId", component: DummyComponent },
        { path: "settings", component: DummyComponent },
      ]),
      ...(optionsInput ? [{ provide: OptionsInput, useValue: optionsInput }] : []),
    ];

    await TestBed.configureTestingModule({
      imports: [OrganizationOptionsComponent],
      providers,
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationOptionsComponent);
    if (!optionsInput) {
      fixture.componentRef.setInput("organizationId", orgId);
    }
    fixture.detectChanges();
  };

  const state = () => fixture.componentInstance["menuState"]();
  const trigger = () =>
    fixture.nativeElement.querySelector(
      `#organization-options_button_menu-${orgId}`,
    ) as HTMLButtonElement | null;

  beforeEach(() => {
    jest.clearAllMocks();
    organizations$ = new BehaviorSubject([buildOrg()]);
    policies$ = new BehaviorSubject<Policy[]>([]);
    decryptionOptions$ = new BehaviorSubject(masterPasswordUser);

    accountService.activeAccount$ = of({ id: userId } as Account);
    organizationService.organizations$.mockReturnValue(organizations$);
    policyService.policies$.mockReturnValue(policies$);
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(decryptionOptions$);
  });

  describe("in the vault side nav", () => {
    beforeEach(() => setup());

    it("finds the organization by id and renders the side-nav icon button", () => {
      expect(state()?.organization.id).toBe(orgId);
      expect(trigger()?.hasAttribute("bitIconButton")).toBe(true);
      expect(trigger()?.classList).not.toContain("filter-options-icon");
    });

    it("renders nothing once the user is no longer a member", () => {
      organizations$.next([]);
      fixture.detectChanges();

      expect(state()).toBeUndefined();
      expect(trigger()).toBeNull();
    });

    it("renders nothing when no option applies", () => {
      // Claimed by this org, so leave is hidden; no SSO; no reset password policy.
      organizations$.next([buildOrg({ userIsClaimedByOrganization: true })]);
      fixture.detectChanges();

      expect(state()).toMatchObject({
        allowEnrollmentChanges: false,
        showSso: false,
        showLeave: false,
      });
      expect(trigger()).toBeNull();
    });

    describe("account recovery enrollment", () => {
      it("is allowed when the org's reset password policy is enabled", () => {
        policies$.next([resetPasswordPolicy()]);
        fixture.detectChanges();

        expect(state()?.allowEnrollmentChanges).toBe(true);
      });

      it("is not allowed when the policy is disabled", () => {
        policies$.next([resetPasswordPolicy({ enabled: false })]);
        fixture.detectChanges();

        expect(state()?.allowEnrollmentChanges).toBe(false);
      });

      it("is not allowed when another org holds the policy", () => {
        policies$.next([resetPasswordPolicy({ organizationId: "other-org" as OrganizationId })]);
        fixture.detectChanges();

        expect(state()?.allowEnrollmentChanges).toBe(false);
      });

      it("can't be withdrawn once auto-enrolled", () => {
        organizations$.next([buildOrg({ resetPasswordEnrolled: true })]);
        policies$.next([resetPasswordPolicy({ data: { autoEnrollEnabled: true } })]);
        fixture.detectChanges();

        expect(state()?.allowEnrollmentChanges).toBe(false);
      });
    });

    it("shows SSO options when the org uses SSO and has an identifier", () => {
      organizations$.next([buildOrg({ useSso: true })]);
      fixture.detectChanges();

      expect(state()?.showSso).toBe(true);
    });

    describe("leave", () => {
      it("is shown for a user with a master password", () => {
        expect(state()?.showLeave).toBe(true);
      });

      it("is hidden for a TDE user with no master password", () => {
        decryptionOptions$.next({
          hasMasterPassword: false,
          trustedDeviceOption: {},
        } as UserDecryptionOptions);
        fixture.detectChanges();

        expect(state()?.showLeave).toBe(false);
      });

      it("leaves the organization once confirmed", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(true);

        await fixture.componentInstance["leave"](buildOrg());

        expect(organizationApiService.leave).toHaveBeenCalledWith(orgId);
      });

      it("moves to All items when the user is viewing the vault they left", async () => {
        const router = TestBed.inject(Router);
        await router.navigateByUrl(`/vault/${orgId}`);
        dialogService.openSimpleDialog.mockResolvedValue(true);

        await fixture.componentInstance["leave"](buildOrg());

        expect(router.url).toBe("/vault");
      });

      it("stays on a page outside the vault the user left", async () => {
        const router = TestBed.inject(Router);
        await router.navigateByUrl("/settings");
        dialogService.openSimpleDialog.mockResolvedValue(true);

        await fixture.componentInstance["leave"](buildOrg());

        expect(router.url).toBe("/settings");
      });

      it("shows the API error, since the menu has closed", async () => {
        const error = new Error("nope");
        dialogService.openSimpleDialog.mockResolvedValue(true);
        organizationApiService.leave.mockRejectedValue(error);

        await fixture.componentInstance["leave"](buildOrg());

        expect(validationService.showError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("in the legacy vault filter", () => {
    beforeEach(() => setup(of(buildOrg() as OrganizationFilter)));

    it("reads the organization from OptionsInput and renders the legacy trigger", () => {
      expect(state()?.organization.id).toBe(orgId);
      expect(trigger()?.classList).toContain("filter-options-icon");
    });
  });
});
