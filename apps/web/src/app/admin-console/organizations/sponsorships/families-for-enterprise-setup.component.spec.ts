import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PreValidateSponsorshipResponse } from "@bitwarden/common/admin-console/models/response/pre-validate-sponsorship.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanSponsorshipType, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, SelectComponent, ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";

// Namespace import: this workspace does not enable `esModuleInterop`, so a default import of a
// JSON module does not resolve to the whole document.
import * as enMessages from "../../../../locales/en/messages.json";
import { OrganizationPlansComponent } from "../../../billing";
import { HeaderModule } from "../../../layouts/header/header.module";

import { FamiliesForEnterpriseSetupComponent } from "./families-for-enterprise-setup.component";

/** Stands in for OrganizationPlansComponent; the plan form is out of scope for this spec. */
@Component({
  selector: "app-organization-plans",
  template: "",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockOrganizationPlansComponent {
  readonly initialPlan = input<PlanType>();
  readonly initialProductTier = input<ProductTierType>();
  readonly acceptingSponsorship = input<boolean>(false);
  readonly planSponsorshipType = input<PlanSponsorshipType>();
  // Name must match the real component's output so the template binding resolves.
  // eslint-disable-next-line @angular-eslint/no-output-on-prefix
  readonly onSuccess = output<unknown>();
}

/**
 * Stands in for `WebHeaderComponent`, whose own dependency tree (product switcher, account menu,
 * banners) is not what this component's template is asserting. Content is still projected so the
 * breadcrumbs rendered by this component remain observable.
 */
@Component({
  selector: "app-header",
  template: "<ng-content></ng-content>",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockWebHeaderComponent {}

describe("FamiliesForEnterpriseSetupComponent", () => {
  let fixture: ComponentFixture<FamiliesForEnterpriseSetupComponent>;
  let component: FamiliesForEnterpriseSetupComponent;

  let apiService: MockProxy<ApiService>;
  let syncService: MockProxy<SyncService>;
  let organizationService: MockProxy<OrganizationService>;
  let logService: MockProxy<LogService>;
  let router: MockProxy<Router>;
  const vfo1Enabled = signal(true);

  function familiesOrg(id: string, name: string) {
    return {
      id,
      name,
      productTierType: ProductTierType.Families,
      type: OrganizationUserType.Owner,
    } as Organization;
  }

  async function setup(
    enabled: boolean,
    options: {
      sponsoringOrganizationName?: string;
      organizations?: Organization[];
      organizations$?: BehaviorSubject<Organization[]>;
    } = {},
  ) {
    vfo1Enabled.set(enabled);

    apiService = mock<ApiService>();
    syncService = mock<SyncService>();
    organizationService = mock<OrganizationService>();
    logService = mock<LogService>();
    router = mock<Router>();
    // DrawerService (pulled in transitively) reads `router.url` and `router.events` on construction.
    Object.defineProperty(router, "url", { value: "/setup/families-for-enterprise" });
    Object.defineProperty(router, "events", { value: of() });

    const preValidateResponse = new PreValidateSponsorshipResponse({
      IsTokenValid: true,
      IsFreeFamilyPolicyEnabled: false,
      SponsoringOrganizationName: options.sponsoringOrganizationName,
    });
    apiService.postPreValidateSponsorshipToken.mockResolvedValue(preValidateResponse);
    syncService.fullSync.mockResolvedValue(true);
    organizationService.organizations$.mockReturnValue(
      options.organizations$ ?? new BehaviorSubject(options.organizations ?? []),
    );

    await TestBed.configureTestingModule({
      imports: [FamiliesForEnterpriseSetupComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: SyncService, useValue: syncService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: LogService, useValue: logService },
        { provide: Router, useValue: router },
        { provide: ValidationService, useValue: mock<ValidationService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...p: string[]) => translate(key, p) },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: new BehaviorSubject({ id: "user-id", email: "test@example.com" }),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({ token: "a-valid-token" }) } },
        {
          provide: Vfo1TerminologyService,
          useValue: { iconClass: (icon: string) => icon, enabled: vfo1Enabled },
        },
      ],
    })
      .overrideComponent(FamiliesForEnterpriseSetupComponent, {
        remove: { imports: [OrganizationPlansComponent, HeaderModule] },
        add: { imports: [MockOrganizationPlansComponent, MockWebHeaderComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FamiliesForEnterpriseSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Mirrors TranslationService placeholder substitution closely enough for copy assertions. */
  function translate(key: string, params: string[]) {
    const entry = (enMessages as Record<string, { message: string }>)[key];
    if (entry == null) {
      return "";
    }
    return entry.message.replace(/\$([A-Z_]+)\$/g, () => params[0] ?? "");
  }

  function text() {
    return fixture.nativeElement.textContent as string;
  }

  /**
   * `bit-option` projects into an `ng-template` and leaves no queryable DOM until the control is
   * opened. Read the select's mapped `items()` instead: it is the ordered list the control renders,
   * carrying each option's label, value, icon and disabled state.
   */
  function options() {
    const select = fixture.debugElement.query(By.directive(SelectComponent))
      .componentInstance as SelectComponent<string>;
    return select.items() ?? [];
  }

  function selectedLabel() {
    const value = component.formGroup.value.selectedFamilyOrganizationId;
    return options().find((o) => o.value === value)?.label;
  }

  function submitButtonText() {
    return (
      fixture.nativeElement.querySelector("button[type=submit]") as HTMLButtonElement
    ).textContent?.trim();
  }

  describe("page header", () => {
    it("renders the breadcrumb header and no bare h1 when the VFO1 flag is on", async () => {
      await setup(true);

      expect(fixture.nativeElement.querySelector("app-header")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("h1")).toBeNull();

      const nav = fixture.nativeElement.querySelector("bit-breadcrumbs");
      expect(nav).not.toBeNull();
      expect(nav.getAttribute("slot")).toBe("breadcrumbs");

      // Only the Settings crumb carries the cog icon (the mocked Router marks no crumb active).
      expect(nav.querySelector("a .bwi-cog")).not.toBeNull();
      expect(nav.textContent).toContain("Settings");
      expect(nav.textContent).toContain("Accept Sponsored Families Plan");
      expect(text()).not.toContain("Accept Free Bitwarden Families");
    });

    it("renders the legacy bare h1 and no header when the VFO1 flag is off", async () => {
      await setup(false);

      expect(fixture.nativeElement.querySelector("app-header")).toBeNull();

      const h1 = fixture.nativeElement.querySelector("h1");
      expect(h1).not.toBeNull();
      expect(h1.textContent.trim()).toBe("Accept Free Bitwarden Families");
    });

    // The flag signal starts false and flips once server config arrives.
    it("switches to the new header and copy when the VFO1 flag turns on at runtime", async () => {
      await setup(false, { organizations: [familiesOrg("org-1", "Jensen family")] });
      expect(fixture.nativeElement.querySelector("h1")).not.toBeNull();

      vfo1Enabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // the new select's projected options resolve on the next pass

      expect(fixture.nativeElement.querySelector("h1")).toBeNull();
      expect(fixture.nativeElement.querySelector("app-header")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-label").textContent).toContain(
        "Select a family vault",
      );
      expect(options().map((o) => o.label)).toEqual(["Jensen family", "Create vault"]);
    });
  });

  describe("description", () => {
    it("names the sponsoring organization when the server provided it", async () => {
      await setup(true, { sponsoringOrganizationName: "Acme corporation" });

      expect(text()).toContain(
        "Acme corporation has sponsored a free Bitwarden Families plan for you!",
      );
    });

    it("falls back to copy without the organization name when the server omitted it", async () => {
      await setup(true);

      const paragraph = fixture.nativeElement.querySelector("p").textContent.trim();
      expect(paragraph).toBe(
        "You've been sponsored a free Bitwarden Families plan! You can apply your complimentary plan to an existing family vault or create a new one.",
      );
    });

    it("renders the legacy description when the VFO1 flag is off", async () => {
      await setup(false, { sponsoringOrganizationName: "Acme corporation" });

      expect(text()).toContain(
        "Accept offer for an existing organization or create a new Families organization.",
      );
      expect(text()).not.toContain("Acme corporation");
    });
  });

  describe("family vault selector", () => {
    it("renders the new label when the VFO1 flag is on", async () => {
      await setup(true);

      expect(fixture.nativeElement.querySelector("bit-label").textContent).toContain(
        "Select a family vault",
      );
    });

    it("renders the legacy label when the VFO1 flag is off", async () => {
      await setup(false);

      expect(fixture.nativeElement.querySelector("bit-label").textContent).toContain(
        "Select the organization you would like sponsored",
      );
    });

    it("lists existing vaults first and Create vault last, with icons, when the flag is on", async () => {
      await setup(true, {
        organizations: [familiesOrg("org-1", "Jensen family"), familiesOrg("org-2", "Doe family")],
      });

      const rendered = options();
      expect(rendered.map((o) => o.label)).toEqual(["Jensen family", "Doe family", "Create vault"]);
      expect(rendered.map((o) => o.value)).toEqual(["org-1", "org-2", "createNew"]);
      expect(rendered.map((o) => o.icon)).toEqual(["bwi-business", "bwi-business", "bwi-plus"]);
      expect(rendered.some((o) => o.disabled)).toBe(false);
      expect(text()).not.toContain("New Families organization");
    });

    it("keeps the legacy option order and no icons when the flag is off", async () => {
      await setup(false, { organizations: [familiesOrg("org-1", "Jensen family")] });

      const rendered = options();
      expect(rendered.map((o) => o.label)).toEqual([
        "-- Select --",
        "New Families organization",
        "Jensen family",
      ]);
      expect(rendered[0].disabled).toBe(true);
      expect(rendered.every((o) => o.icon === undefined)).toBe(true);
    });
  });

  describe("default selection", () => {
    it("preselects Create vault in the dropdown for a user with no Families organization when the flag is on", async () => {
      await setup(true, { organizations: [] });

      expect(component.formGroup.value.selectedFamilyOrganizationId).toBe("createNew");
      expect(component.showNewOrganization).toBe(true);
      expect(selectedLabel()).toBe("Create vault");
    });

    it("preselects Create vault for a user who owns a Families organization when the flag is on", async () => {
      await setup(true, { organizations: [familiesOrg("org-1", "Jensen family")] });

      expect(component.formGroup.value.selectedFamilyOrganizationId).toBe("createNew");
      expect(component.showNewOrganization).toBe(true);
      expect(selectedLabel()).toBe("Create vault");
    });

    it("keeps the user's choice when the organization list re-emits", async () => {
      const organizations = new BehaviorSubject([familiesOrg("org-1", "Jensen family")]);
      await setup(true, { organizations$: organizations });
      component.formGroup.patchValue({ selectedFamilyOrganizationId: "org-1" });

      organizations.next([familiesOrg("org-1", "Jensen family")]);
      fixture.detectChanges();

      expect(component.formGroup.value.selectedFamilyOrganizationId).toBe("org-1");
      expect(component.showNewOrganization).toBe(false);
    });

    it("flag off: shows the create form for a user with no Families organization without touching the control", async () => {
      await setup(false, { organizations: [] });

      expect(component.selectedFamilyOrganizationId).toBe("createNew");
      expect(component.showNewOrganization).toBe(true);
      expect(component.formGroup.value.selectedFamilyOrganizationId).toBe("");
    });

    it("flag off: selects nothing for a user who owns a Families organization", async () => {
      await setup(false, { organizations: [familiesOrg("org-1", "Jensen family")] });

      expect(component.selectedFamilyOrganizationId).not.toBe("createNew");
      expect(component.showNewOrganization).toBe(false);
    });
  });

  describe("existing vault path", () => {
    it("shows only the Apply sponsorship button when an existing vault is picked and the flag is on", async () => {
      await setup(true, { organizations: [familiesOrg("org-1", "Jensen family")] });

      component.formGroup.patchValue({ selectedFamilyOrganizationId: "org-1" });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("app-organization-plans")).toBeNull();
      expect(submitButtonText()).toBe("Apply sponsorship");
      expect(text()).not.toContain("Accept offer");
    });

    it("keeps the Accept offer button when the flag is off", async () => {
      await setup(false, { organizations: [familiesOrg("org-1", "Jensen family")] });

      component.formGroup.patchValue({ selectedFamilyOrganizationId: "org-1" });
      fixture.detectChanges();

      expect(submitButtonText()).toBe("Accept offer");
    });

    it("hands the sponsorship context to the plan form when creating a new vault", async () => {
      await setup(true, { organizations: [] });
      fixture.detectChanges();

      const plans = fixture.debugElement.query(By.directive(MockOrganizationPlansComponent))
        .componentInstance as MockOrganizationPlansComponent;
      expect(plans.acceptingSponsorship()).toBe(true);
      expect(plans.initialPlan()).toBe(PlanType.FamiliesAnnually);
      expect(plans.initialProductTier()).toBe(ProductTierType.Families);
      expect(plans.planSponsorshipType()).toBe(PlanSponsorshipType.FamiliesForEnterprise);
    });
  });

  describe("logging", () => {
    it("never passes the sponsoring organization name to the log service", async () => {
      const orgName = "Acme corporation";
      await setup(true, {
        sponsoringOrganizationName: orgName,
        organizations: [familiesOrg("org-1", "Jensen family")],
      });

      const loggedArgs = [
        ...logService.info.mock.calls,
        ...logService.warning.mock.calls,
        ...logService.error.mock.calls,
        ...logService.debug.mock.calls,
      ].flat();

      expect(loggedArgs.length).toBeGreaterThan(0);
      loggedArgs.forEach((arg) => {
        expect(String(arg)).not.toContain(orgName);
      });
    });
  });

  describe("i18n keys", () => {
    // Guards against a rename or bad merge: TranslationService returns "" for a missing key,
    // which would render as blank copy on a redemption page.
    it.each([
      "acceptSponsoredFamiliesPlan",
      "acceptSponsoredFamiliesPlanHelp",
      "acceptSponsoredFamiliesPlanHelpNoOrg",
      "selectAFamilyVault",
      "sponsoredPlanDetails",
      "createVault",
      "applySponsorship",
    ])("defines %s in the en locale", (key) => {
      const entry = (enMessages as Record<string, { message: string }>)[key];
      expect(entry).toBeDefined();
      expect(entry.message.length).toBeGreaterThan(0);
    });

    it("declares the organization placeholder for the parameterized help copy", () => {
      const entry = (enMessages as Record<string, any>)["acceptSponsoredFamiliesPlanHelp"];
      expect(entry.message).toContain("$ORGANIZATION$");
      expect(entry.placeholders.organization.content).toBe("$1");
    });
  });
});
