import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainMiniResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain-mini.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DefaultServerSettingsService } from "@bitwarden/common/platform/services/default-server-settings.service";
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

function buildDomain(domainName: string, verified: boolean): OrganizationDomainMiniResponse {
  return {
    domainName,
    verifiedDate: verified ? "2025-01-01T00:00:00Z" : null,
  } as unknown as OrganizationDomainMiniResponse;
}

interface Harness {
  fixture: ComponentFixture<ByLinkTabComponent>;
  component: ByLinkTabComponent;
  inviteLink$: BehaviorSubject<OrganizationInviteLink | undefined>;
  inviteLinkService: MockProxy<OrganizationInviteLinkService>;
  validationService: MockProxy<ValidationService>;
  orgDomainApiService: MockProxy<OrgDomainApiServiceAbstraction>;
}

async function createComponent(
  options: {
    initialLink?: OrganizationInviteLink;
    autoConfirmEnabled?: boolean;
    domains?: OrganizationDomainMiniResponse[];
    domainsError?: unknown;
    showCoachMarks?: boolean;
  } = {},
): Promise<Harness> {
  const { initialLink, autoConfirmEnabled = true, showCoachMarks = false } = options;

  const inviteLink$ = new BehaviorSubject<OrganizationInviteLink | undefined>(initialLink);

  const inviteLinkService = mock<OrganizationInviteLinkService>();
  inviteLinkService.inviteLink$.mockReturnValue(inviteLink$.asObservable());
  inviteLinkService.reconstructUrl.mockReturnValue(of("https://vault.bitwarden.com/#/join/org-1"));

  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of({ id: USER_ID } as any);

  const orgDomainApiService = mock<OrgDomainApiServiceAbstraction>();
  if (options.domainsError != null) {
    orgDomainApiService.getAllMiniByOrgId.mockRejectedValue(options.domainsError);
  } else {
    orgDomainApiService.getAllMiniByOrgId.mockResolvedValue(options.domains ?? []);
  }

  const configService = mock<ConfigService>();
  configService.getFeatureFlag$.mockImplementation((flag) =>
    of(flag === FeatureFlag.InviteLinkAutoConfirm ? autoConfirmEnabled : false),
  ) as any;

  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key) => key);

  const validationService = mock<ValidationService>();

  const serverSettingsService = mock<DefaultServerSettingsService>({
    isEmailVerificationDisabled$: of(false),
  });

  await TestBed.configureTestingModule({
    imports: [ByLinkTabComponent],
    providers: [
      provideNoopAnimations(),
      { provide: OrganizationInviteLinkService, useValue: inviteLinkService },
      { provide: AccountService, useValue: accountService },
      { provide: OrgDomainApiServiceAbstraction, useValue: orgDomainApiService },
      { provide: ConfigService, useValue: configService },
      { provide: I18nService, useValue: i18nService },
      { provide: ValidationService, useValue: validationService },
      { provide: LogService, useValue: mock<LogService>() },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
      { provide: DefaultServerSettingsService, useValue: serverSettingsService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ByLinkTabComponent);
  fixture.componentRef.setInput("organizationId", ORG_ID);
  fixture.componentRef.setInput("showCoachMarks", showCoachMarks);
  fixture.detectChanges();
  await fixture.whenStable();

  return {
    fixture,
    component: fixture.componentInstance,
    inviteLink$,
    inviteLinkService,
    validationService,
    orgDomainApiService,
  };
}

/** The switch only renders once a link exists and the flag is on. */
function switchRendered(fixture: ComponentFixture<ByLinkTabComponent>): boolean {
  return (
    fixture.nativeElement.querySelector("#by-link-tab_switch_require-admin-confirmation") != null
  );
}

describe("ByLinkTabComponent", () => {
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
      const { component, orgDomainApiService } = await createComponent({
        initialLink: makeInviteLink(true),
      });

      expect(orgDomainApiService.getAllMiniByOrgId).not.toHaveBeenCalled();
      expect(component.form.controls.domains.value).toBe("example.com");
    });
  });

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

    // The step 1 coachmark popover's backdrop blocks clicks into the page, so a click-driven
    // refocus of the invalid field isn't possible while it's open.
    it("refocuses the domains field when the form is invalid", async () => {
      const { fixture, component, inviteLinkService } = await createComponent();
      const domainsInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="allowedDomains"]',
      );
      const focus = jest.spyOn(domainsInput, "focus");

      component.form.controls.domains.setValue("");
      await component.save();

      expect(inviteLinkService.createInviteLink).not.toHaveBeenCalled();
      expect(focus).toHaveBeenCalled();
    });

    it("refocuses the domains field when advancing the tour with an invalid form", async () => {
      const { fixture, component, inviteLinkService } = await createComponent();
      const domainsInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="allowedDomains"]',
      );
      const focus = jest.spyOn(domainsInput, "focus");

      component.form.controls.domains.setValue("");
      await component.saveAndAdvanceToStep2();

      expect(inviteLinkService.createInviteLink).not.toHaveBeenCalled();
      expect(component.tourStep()).not.toBe(2);
      expect(focus).toHaveBeenCalled();
    });

    // Angular's `Validators.required` only rejects an empty string, so comma/whitespace-only
    // input (e.g. ",  ,") passes form validation yet parses down to zero domains. Without this,
    // the empty array reached the service layer, which threw "At least one allowed domain is
    // required." — an error the refocus logic never saw because it lived past the form-validity
    // check.
    it("treats comma/whitespace-only input as empty, without calling the service", async () => {
      const { fixture, component, inviteLinkService } = await createComponent();
      const domainsInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="allowedDomains"]',
      );
      const focus = jest.spyOn(domainsInput, "focus");

      component.form.controls.domains.setValue(" , , ");
      expect(component.form.valid).toBe(true);
      expect(component.domainsEmpty()).toBe(true);

      await component.save();

      expect(inviteLinkService.createInviteLink).not.toHaveBeenCalled();
      expect(inviteLinkService.updateAllowedDomains).not.toHaveBeenCalled();
      expect(focus).toHaveBeenCalled();
    });

    // The server can reject domains that pass client-side parsing (e.g. malformed or duplicate
    // domains). The rejection is only visible to `[bitAction]`'s generic error toast, which has
    // no way to reach into the component to refocus the field — save() has to do it itself.
    it("refocuses the domains field and rethrows when the server rejects the save", async () => {
      const { fixture, component, inviteLinkService } = await createComponent();
      const domainsInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="allowedDomains"]',
      );
      const focus = jest.spyOn(domainsInput, "focus");
      const failure = new Error("At least one allowed domain is required.");
      inviteLinkService.createInviteLink.mockRejectedValue(failure);

      component.form.controls.domains.setValue("example.com");

      await expect(component.save()).rejects.toThrow(failure);
      expect(focus).toHaveBeenCalled();
    });
  });

  // TODO(coachmark cleanup): remove this describe block with the rest of the guided tour.
  describe("guided tour", () => {
    function saveButtonDisabled(fixture: ComponentFixture<ByLinkTabComponent>): boolean {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="saveDomains"]',
      );
      // bitButton aria-disables rather than setting the native `disabled` attribute (see
      // ariaDisableElement in @bitwarden/components), so check aria-disabled instead.
      return button.getAttribute("aria-disabled") === "true";
    }

    it("enables the save button when the tour is not running", async () => {
      const { fixture, component } = await createComponent({ showCoachMarks: false });
      component.form.controls.domains.setValue("example.com");
      fixture.detectChanges();

      expect(saveButtonDisabled(fixture)).toBe(false);
    });

    it("disables the save button once the tour starts, even with valid domains", async () => {
      const { fixture, component } = await createComponent({ showCoachMarks: true });
      component.form.controls.domains.setValue("example.com");

      component.tourStep.set(1);
      fixture.detectChanges();

      expect(saveButtonDisabled(fixture)).toBe(true);
    });

    it("re-enables the save button once the tour finishes", async () => {
      const { fixture, component } = await createComponent({ showCoachMarks: true });
      component.form.controls.domains.setValue("example.com");

      component.tourStep.set(1);
      fixture.detectChanges();
      expect(saveButtonDisabled(fixture)).toBe(true);

      component.tourStep.set(0);
      fixture.detectChanges();

      expect(saveButtonDisabled(fixture)).toBe(false);
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
