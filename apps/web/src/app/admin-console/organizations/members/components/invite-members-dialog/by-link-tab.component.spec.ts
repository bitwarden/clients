import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainMiniResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain-mini.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { ByLinkTabComponent } from "./by-link-tab.component";

const ORG_ID = "org-id" as any;
const ACCOUNT_ID = "account-id" as any;

function buildDomain(domainName: string, verified: boolean): OrganizationDomainMiniResponse {
  return {
    domainName,
    verifiedDate: verified ? "2025-01-01T00:00:00Z" : null,
  } as unknown as OrganizationDomainMiniResponse;
}

async function createComponent(
  overrides: {
    inviteLink?: OrganizationInviteLink;
    domains?: OrganizationDomainMiniResponse[];
    domainsError?: unknown;
  } = {},
): Promise<{
  fixture: ComponentFixture<ByLinkTabComponent>;
  component: ByLinkTabComponent;
  orgDomainApiService: MockProxy<OrgDomainApiServiceAbstraction>;
}> {
  const accountService = mock<AccountService>();
  const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
  const inviteLinkService = mock<OrganizationInviteLinkService>();
  const toastService = mock<ToastService>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const eventCollectionService = mock<EventCollectionService>();
  const logService = mock<LogService>();

  accountService.activeAccount$ = of({ id: ACCOUNT_ID } as any);
  inviteLinkService.inviteLink$.mockReturnValue(of(overrides.inviteLink));
  inviteLinkService.reconstructUrl.mockReturnValue(of("https://example.com/invite"));
  if (overrides.domainsError != null) {
    orgDomainApiService.getAllMiniByOrgId.mockRejectedValue(overrides.domainsError);
  } else {
    orgDomainApiService.getAllMiniByOrgId.mockResolvedValue(overrides.domains ?? []);
  }
  i18nService.t.mockReturnValue("translated");

  await TestBed.configureTestingModule({
    imports: [ByLinkTabComponent],
    providers: [
      provideNoopAnimations(),
      { provide: AccountService, useValue: accountService },
      { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
      { provide: OrganizationInviteLinkService, useValue: inviteLinkService },
      { provide: ToastService, useValue: toastService },
      { provide: I18nService, useValue: i18nService },
      { provide: PlatformUtilsService, useValue: platformUtilsService },
      { provide: EventCollectionService, useValue: eventCollectionService },
      { provide: LogService, useValue: logService },
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
    it("prefills verified domains and ignores unverified ones", async () => {
      const { component, orgDomainApiService } = await createComponent({
        domains: [buildDomain("example.com", true), buildDomain("unverified.com", false)],
      });

      expect(orgDomainApiService.getAllMiniByOrgId).toHaveBeenCalledWith(ORG_ID);
      expect(component.form.controls.domains.value).toBe("example.com");
    });

    // The full domains endpoint requires the Manage SSO permission. Requesting it without that
    // permission returns a 401, which logs the user out of the vault entirely. The mini endpoint
    // also accepts Manage Users, so members who can only manage users still get the prefill.
    it("reads domains from the mini endpoint rather than the Manage SSO one", async () => {
      const { orgDomainApiService } = await createComponent({
        domains: [buildDomain("example.com", true)],
      });

      expect(orgDomainApiService.getAllByOrgId).not.toHaveBeenCalled();
    });

    it("leaves the field empty when the org has no verified domains", async () => {
      const { component } = await createComponent({
        domains: [buildDomain("unverified.com", false)],
      });

      expect(component.form.controls.domains.value).toBe("");
    });

    // Servers predating the mini endpoint answer with a 404. Prefilling is a convenience, so the
    // dialog must stay usable rather than blowing up with an unhandled rejection.
    it("leaves the field empty when the domains request fails", async () => {
      const { component } = await createComponent({
        domainsError: new Error("404 Not Found"),
      });

      expect(component.form.controls.domains.value).toBe("");
    });

    it("does not request org domains when an invite link already exists", async () => {
      const inviteLink = {
        id: "link-1",
        allowedDomains: ["existing.com"],
      } as unknown as OrganizationInviteLink;

      const { component, orgDomainApiService } = await createComponent({ inviteLink });

      expect(orgDomainApiService.getAllMiniByOrgId).not.toHaveBeenCalled();
      expect(component.form.controls.domains.value).toBe("existing.com");
    });
  });
});
