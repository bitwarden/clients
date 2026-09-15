import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";
import { Invite } from "@bitwarden/sdk-internal";

import { ByLinkTabComponent } from "./by-link-tab.component";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

function makeInviteLink(supportsConfirmation: boolean): OrganizationInviteLink {
  return Object.assign(new OrganizationInviteLink({} as any), {
    id: "link-1",
    code: "abc123",
    organizationId: ORG_ID,
    allowedDomains: ["example.com"],
    invite: "sealed-invite" as Invite,
    supportsConfirmation,
    creationDate: "2025-01-15T10:30:00Z",
  });
}

interface Harness {
  fixture: ComponentFixture<ByLinkTabComponent>;
  component: ByLinkTabComponent;
  inviteLink$: BehaviorSubject<OrganizationInviteLink | undefined>;
  inviteLinkService: MockProxy<OrganizationInviteLinkService>;
  validationService: MockProxy<ValidationService>;
}

async function createComponent(
  options: {
    initialLink?: OrganizationInviteLink;
    autoConfirmEnabled?: boolean;
  } = {},
): Promise<Harness> {
  const { initialLink, autoConfirmEnabled = true } = options;

  const inviteLink$ = new BehaviorSubject<OrganizationInviteLink | undefined>(initialLink);

  const inviteLinkService = mock<OrganizationInviteLinkService>();
  inviteLinkService.inviteLink$.mockReturnValue(inviteLink$.asObservable());
  inviteLinkService.reconstructUrl.mockReturnValue(of("https://vault.bitwarden.com/#/join/org-1"));

  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of({ id: USER_ID } as any);

  const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
  orgDomainApiService.getAllByOrgId.mockResolvedValue([]);

  const configService = mock<ConfigService>();
  configService.getFeatureFlag$.mockImplementation((flag) =>
    of(flag === FeatureFlag.InviteLinkAutoConfirm ? autoConfirmEnabled : false),
  ) as any;

  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key) => key);

  const validationService = mock<ValidationService>();

  await TestBed.configureTestingModule({
    imports: [ByLinkTabComponent],
    providers: [
      { provide: OrganizationInviteLinkService, useValue: inviteLinkService },
      { provide: AccountService, useValue: accountService },
      { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
      { provide: ConfigService, useValue: configService },
      { provide: I18nService, useValue: i18nService },
      { provide: ValidationService, useValue: validationService },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ByLinkTabComponent);
  fixture.componentRef.setInput("organizationId", ORG_ID);
  fixture.detectChanges();
  await fixture.whenStable();

  return {
    fixture,
    component: fixture.componentInstance,
    inviteLink$,
    inviteLinkService,
    validationService,
  };
}

/** The switch only renders once a link exists and the flag is on. */
function switchRendered(fixture: ComponentFixture<ByLinkTabComponent>): boolean {
  return (
    fixture.nativeElement.querySelector("#by-link-tab_switch_require-admin-confirmation") != null
  );
}

describe("ByLinkTabComponent", () => {
  describe("require admin confirmation switch", () => {
    it("is hidden when no link exists yet", async () => {
      const { fixture } = await createComponent();

      expect(switchRendered(fixture)).toBe(false);
    });

    it("is hidden when the feature flag is off, even with an existing link", async () => {
      const { fixture } = await createComponent({
        initialLink: makeInviteLink(true),
        autoConfirmEnabled: false,
      });

      expect(switchRendered(fixture)).toBe(false);
    });

    it("renders off for a link on the link-confirm flow", async () => {
      const { fixture, component } = await createComponent({
        initialLink: makeInviteLink(true),
      });

      expect(switchRendered(fixture)).toBe(true);
      expect(component.requireAdminConfirmation.value).toBe(false);
    });

    it("renders on for a link on the accept flow", async () => {
      const { component } = await createComponent({ initialLink: makeInviteLink(false) });

      expect(component.requireAdminConfirmation.value).toBe(true);
    });

    it("does not call the server while being populated from the loaded link", async () => {
      const { inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(false),
      });

      expect(inviteLinkService.setInviteConfirmation).not.toHaveBeenCalled();
    });

    it("turns confirmation off when the user switches it on", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(true),
      });

      component.requireAdminConfirmation.setValue(true);
      await new Promise(process.nextTick);

      expect(inviteLinkService.setInviteConfirmation).toHaveBeenCalledWith(USER_ID, ORG_ID, false);
    });

    it("turns confirmation on when the user switches it off", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(false),
      });

      component.requireAdminConfirmation.setValue(false);
      await new Promise(process.nextTick);

      expect(inviteLinkService.setInviteConfirmation).toHaveBeenCalledWith(USER_ID, ORG_ID, true);
    });

    it("rolls the switch back and reports the error when the update fails", async () => {
      const { component, inviteLinkService, validationService } = await createComponent({
        initialLink: makeInviteLink(true),
      });
      const failure = new Error("server said no");
      inviteLinkService.setInviteConfirmation.mockRejectedValue(failure);

      component.requireAdminConfirmation.setValue(true);
      await new Promise(process.nextTick);

      expect(component.requireAdminConfirmation.value).toBe(false);
      expect(component.requireAdminConfirmation.enabled).toBe(true);
      expect(validationService.showError).toHaveBeenCalledWith(failure);
    });
  });

  describe("save", () => {
    it("creates the first link on the link-confirm flow", async () => {
      const { component, inviteLinkService } = await createComponent();

      component.form.controls.domains.setValue("example.com");
      await component.save();

      expect(inviteLinkService.createInviteLink).toHaveBeenCalledWith(
        USER_ID,
        ORG_ID,
        ["example.com"],
        true,
      );
    });

    it("creates the first link without confirmation support when the flag is off", async () => {
      const { component, inviteLinkService } = await createComponent({
        autoConfirmEnabled: false,
      });

      component.form.controls.domains.setValue("example.com");
      await component.save();

      expect(inviteLinkService.createInviteLink).toHaveBeenCalledWith(
        USER_ID,
        ORG_ID,
        ["example.com"],
        false,
      );
    });

    it("only updates domains once a link exists", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(false),
      });

      component.form.controls.domains.setValue("acme.com");
      await component.save();

      expect(inviteLinkService.createInviteLink).not.toHaveBeenCalled();
      expect(inviteLinkService.updateAllowedDomains).toHaveBeenCalledWith(USER_ID, ORG_ID, [
        "acme.com",
      ]);
    });

    it("leaves the switch untouched, so copying stays enabled", async () => {
      const { component } = await createComponent({ initialLink: makeInviteLink(true) });

      component.requireAdminConfirmation.setValue(true);
      await new Promise(process.nextTick);

      expect(component.form.dirty).toBe(false);
    });
  });

  describe("refreshLink", () => {
    it("carries the current confirmation setting over to the new link", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(true),
      });

      await component.refreshLink();

      expect(inviteLinkService.refreshInviteLink).toHaveBeenCalledWith(USER_ID, ORG_ID, true);
    });

    it("keeps admin confirmation in place across a refresh", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(false),
      });

      await component.refreshLink();

      expect(inviteLinkService.refreshInviteLink).toHaveBeenCalledWith(USER_ID, ORG_ID, false);
    });

    it("refreshes without confirmation support when the flag is off", async () => {
      const { component, inviteLinkService } = await createComponent({
        initialLink: makeInviteLink(true),
        autoConfirmEnabled: false,
      });

      await component.refreshLink();

      expect(inviteLinkService.refreshInviteLink).toHaveBeenCalledWith(USER_ID, ORG_ID, false);
    });
  });
});
