import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { ByLinkTabComponent } from "./by-link-tab.component";

const ORG_ID = "test-org-id" as OrganizationId;
const USER_ID = "test-user-id" as UserId;

async function createComponent(
  overrides: {
    inviteLink?: OrganizationInviteLink | null;
    verifiedDomains?: string[];
  } = {},
): Promise<{
  fixture: ComponentFixture<ByLinkTabComponent>;
  component: ByLinkTabComponent;
  mocks: {
    accountService: MockProxy<AccountService>;
    inviteLinkService: MockProxy<OrganizationInviteLinkService>;
    orgDomainApiService: MockProxy<OrgDomainApiServiceAbstraction>;
    toastService: MockProxy<ToastService>;
    i18nService: MockProxy<I18nService>;
    platformUtilsService: MockProxy<PlatformUtilsService>;
  };
}> {
  const accountService = mock<AccountService>();
  const inviteLinkService = mock<OrganizationInviteLinkService>();
  const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
  const toastService = mock<ToastService>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  accountService.activeAccount$ = of({ id: USER_ID } as any);

  const inviteLink = overrides.inviteLink !== undefined ? overrides.inviteLink : null;
  inviteLinkService.inviteLink$ = jest.fn().mockReturnValue(of(inviteLink));
  inviteLinkService.reconstructUrl = jest.fn().mockReturnValue(of("https://example.com/join"));

  const verifiedDomains = overrides.verifiedDomains ?? [];
  orgDomainApiService.getAllByOrgId = jest
    .fn()
    .mockResolvedValue(verifiedDomains.map((d) => ({ domainName: d, verifiedDate: new Date() })));

  i18nService.t = jest.fn().mockReturnValue("translated");

  await TestBed.configureTestingModule({
    imports: [ByLinkTabComponent],
    providers: [
      { provide: AccountService, useValue: accountService },
      { provide: OrganizationInviteLinkService, useValue: inviteLinkService },
      { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
      { provide: ToastService, useValue: toastService },
      { provide: I18nService, useValue: i18nService },
      { provide: PlatformUtilsService, useValue: platformUtilsService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ByLinkTabComponent);
  const component = fixture.componentInstance;
  fixture.componentRef.setInput("organizationId", ORG_ID);

  return {
    fixture,
    component,
    mocks: {
      accountService,
      inviteLinkService,
      orgDomainApiService,
      toastService,
      i18nService,
      platformUtilsService,
    },
  };
}

describe("ByLinkTabComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  describe("isFilledFromClaimedDomains", () => {
    it("is false by default", async () => {
      const { component } = await createComponent();
      expect(component["isFilledFromClaimedDomains"]()).toBe(false);
    });

    it("is set to true after prefillFromVerifiedDomains populates the domains field", async () => {
      const { fixture, component } = await createComponent({
        inviteLink: null,
        verifiedDomains: ["example.com"],
      });

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["isFilledFromClaimedDomains"]()).toBe(true);
    });

    it("resets to false when the user edits the domain field", async () => {
      const { fixture, component } = await createComponent({
        inviteLink: null,
        verifiedDomains: ["example.com"],
      });

      fixture.detectChanges();
      await fixture.whenStable();

      // Hint is on after prefill
      expect(component["isFilledFromClaimedDomains"]()).toBe(true);

      // User edits the field — resetHintOnEdit() should clear it
      component["form"].controls.domains.setValue("user-typed.com");

      expect(component["isFilledFromClaimedDomains"]()).toBe(false);
    });
  });
});
