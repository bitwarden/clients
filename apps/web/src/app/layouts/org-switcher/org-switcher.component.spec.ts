import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import type { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DialogService,
  IconTileComponent,
  SideNavService,
  SideNavVersion,
} from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { OrgSwitcherComponent } from "./org-switcher.component";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("OrgSwitcherComponent", () => {
  let fixture: ComponentFixture<OrgSwitcherComponent>;

  let vfo1Enabled = false;

  const userId = "user-id" as UserId;
  const organization = { id: "org-1", name: "Test Org", enabled: true } as Organization;

  const i18nService = mock<I18nService>();
  const organizationService = mock<OrganizationService>();
  const configService = mock<ConfigService>();

  beforeEach(async () => {
    vfo1Enabled = false;

    i18nService.t.mockImplementation((key: string) => key);
    organizationService.organizations$.mockReturnValue(of([organization]));
    configService.getFeatureFlag$.mockImplementation(() => of(vfo1Enabled));

    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), OrgSwitcherComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ organizationId: organization.id })) },
        },
        { provide: ConfigService, useValue: configService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();
  });

  function render(hideNewButton = false, version: SideNavVersion = "default"): void {
    fixture = TestBed.createComponent(OrgSwitcherComponent);
    const sideNavService = TestBed.inject(SideNavService);
    // Nav items only render their text when the side nav is expanded.
    sideNavService.open.set(true);
    sideNavService.version.set(version);
    fixture.componentInstance.hideNewButton = hideNewButton;
    fixture.componentInstance.open = true;
    fixture.detectChanges();
  }

  function newOrganizationItem(): HTMLElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-nav-item")).find((el) =>
      (el as HTMLElement).textContent?.includes("newOrganization"),
    ) as HTMLElement | undefined;
  }

  it.each([
    [ProductTierType.Enterprise, "purple"],
    [ProductTierType.Families, "teal"],
  ])("colors the active organization's tile by plan (%s)", (tier, variant) => {
    vfo1Enabled = true;
    organizationService.organizations$.mockReturnValue(
      of([{ ...organization, productTierType: tier } as Organization]),
    );

    render(false, "vfo1");

    const tile = fixture.debugElement.query(By.directive(IconTileComponent))
      .componentInstance as IconTileComponent;
    expect(tile.variant()).toBe(variant);
  });

  it("shows the New organization item when the VFO1 foundation flag is off", () => {
    render();

    expect(newOrganizationItem()).toBeTruthy();
  });

  it("hides the New organization item when the VFO1 foundation flag is on", () => {
    vfo1Enabled = true;

    render();

    expect(newOrganizationItem()).toBeUndefined();
  });

  it("hides the New organization item when hideNewButton is set", () => {
    render(true);

    expect(newOrganizationItem()).toBeUndefined();
  });
});
