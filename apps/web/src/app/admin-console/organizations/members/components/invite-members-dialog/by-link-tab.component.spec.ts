import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { ByLinkTabComponent } from "./by-link-tab.component";

const ORG_ID = "org-id" as any;
const ACCOUNT_ID = "account-id" as any;

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    canManageDomainVerification: true,
    ...overrides,
  } as unknown as Organization;
}

function buildDomain(domainName: string, verified: boolean): OrganizationDomainResponse {
  return {
    domainName,
    verifiedDate: verified ? "2025-01-01T00:00:00Z" : null,
  } as unknown as OrganizationDomainResponse;
}

async function createComponent(
  overrides: {
    orgOverrides?: Partial<Organization>;
    inviteLink?: OrganizationInviteLink;
    domains?: OrganizationDomainResponse[];
  } = {},
): Promise<{
  fixture: ComponentFixture<ByLinkTabComponent>;
  component: ByLinkTabComponent;
  orgDomainApiService: MockProxy<OrgDomainApiServiceAbstraction>;
}> {
  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();
  const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
  const inviteLinkService = mock<OrganizationInviteLinkService>();
  const toastService = mock<ToastService>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const eventCollectionService = mock<EventCollectionService>();

  accountService.activeAccount$ = of({ id: ACCOUNT_ID } as any);
  organizationService.organizations$.mockReturnValue(of([buildOrg(overrides.orgOverrides)]));
  inviteLinkService.inviteLink$.mockReturnValue(of(overrides.inviteLink));
  inviteLinkService.reconstructUrl.mockReturnValue(of("https://example.com/invite"));
  orgDomainApiService.getAllByOrgId.mockResolvedValue(overrides.domains ?? []);
  i18nService.t.mockReturnValue("translated");

  await TestBed.configureTestingModule({
    imports: [ByLinkTabComponent],
    providers: [
      provideNoopAnimations(),
      { provide: AccountService, useValue: accountService },
      { provide: OrganizationService, useValue: organizationService },
      { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
      { provide: OrganizationInviteLinkService, useValue: inviteLinkService },
      { provide: ToastService, useValue: toastService },
      { provide: I18nService, useValue: i18nService },
      { provide: PlatformUtilsService, useValue: platformUtilsService },
      { provide: EventCollectionService, useValue: eventCollectionService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ByLinkTabComponent);
  fixture.componentRef.setInput("organizationId", ORG_ID);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, component: fixture.componentInstance, orgDomainApiService };
}

describe("ByLinkTabComponent", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("prefilling domains from verified org domains", () => {
    it("prefills verified domains when the user can manage domain verification", async () => {
      const { component, orgDomainApiService } = await createComponent({
        domains: [buildDomain("example.com", true), buildDomain("unverified.com", false)],
      });

      expect(orgDomainApiService.getAllByOrgId).toHaveBeenCalledWith(ORG_ID);
      expect(component.form.controls.domains.value).toBe("example.com");
    });

    // The domains endpoint requires the Manage SSO permission. Requesting it without that
    // permission returns a 401, which logs the user out of the vault entirely.
    it("does not request org domains when the user cannot manage domain verification", async () => {
      const { component, orgDomainApiService } = await createComponent({
        orgOverrides: { canManageDomainVerification: false } as Partial<Organization>,
        domains: [buildDomain("example.com", true)],
      });

      expect(orgDomainApiService.getAllByOrgId).not.toHaveBeenCalled();
      expect(component.form.controls.domains.value).toBe("");
    });

    it("does not request org domains when an invite link already exists", async () => {
      const inviteLink = {
        id: "link-1",
        allowedDomains: ["existing.com"],
      } as unknown as OrganizationInviteLink;

      const { component, orgDomainApiService } = await createComponent({ inviteLink });

      expect(orgDomainApiService.getAllByOrgId).not.toHaveBeenCalled();
      expect(component.form.controls.domains.value).toBe("existing.com");
    });
  });
});
