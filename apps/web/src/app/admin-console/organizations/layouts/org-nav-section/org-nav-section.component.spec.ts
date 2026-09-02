import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import {
  ActivatedRoute,
  convertToParamMap,
  ParamMap,
  provideRouter,
  Router,
} from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { NavigationModule, SideNavService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { OrgNavSectionComponent } from "./org-nav-section.component";

const userId = "user-id" as UserId;

function makeOrg(overrides: Partial<Organization>): Organization {
  return {
    enabled: true,
    isOwner: true,
    canManageUsers: true,
    canViewAllCollections: true,
    productTierType: ProductTierType.Enterprise,
    ...overrides,
  } as unknown as Organization;
}

const acme = makeOrg({ id: "org-a" as OrganizationId, name: "Acme corporation" });
const globex = makeOrg({ id: "org-b" as OrganizationId, name: "Globex" });
// Administers members but cannot view collections, so the vault tab is off limits.
const noVaultAccess = makeOrg({
  id: "org-d" as OrganizationId,
  name: "Bevel co",
  isAdmin: false,
  isOwner: false,
  canViewAllCollections: false,
});
// A member with no administrative permission at all — the Admin Console nav must skip it.
const memberOnly = makeOrg({
  id: "org-c" as OrganizationId,
  name: "Aardvark inc",
  isOwner: false,
  canManageUsers: false,
  canViewAllCollections: false,
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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

describe("OrgNavSectionComponent", () => {
  let fixture: ComponentFixture<OrgNavSectionComponent>;

  const organizations$ = new BehaviorSubject<Organization[]>([acme, globex, memberOnly]);
  const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ organizationId: "org-a" }));
  const queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const i18nService = mock<I18nService>();

  /** The group labels rendered, in document order. */
  const groupText = () =>
    fixture.debugElement.queryAll(By.css("bit-nav-group")).map((el) => el.componentInstance.text());

  const navItem = (text: string) =>
    fixture.debugElement
      .queryAll(By.css("bit-nav-item"))
      .find((el) => el.componentInstance.text() === text);

  const openGroup = (groupLabel: string) => {
    const group = fixture.debugElement
      .queryAll(By.css("bit-nav-group"))
      .find((el) => el.componentInstance.text() === groupLabel)!;
    group.componentInstance.open.set(true);
    fixture.detectChanges();
    return group.nativeElement as HTMLElement;
  };

  const hrefsWithin = (groupLabel: string) =>
    Array.from(openGroup(groupLabel).querySelectorAll("bit-nav-item a")).map((a) =>
      a.getAttribute("href"),
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    organizations$.next([acme, globex, memberOnly]);
    paramMap$.next(convertToParamMap({ organizationId: "org-a" }));
    queryParamMap$.next(convertToParamMap({}));

    i18nService.t.mockImplementation((key: string) => key);
    accountService.activeAccount$ = of({ id: userId } as Account);
    organizationService.organizations$.mockReturnValue(organizations$);

    await TestBed.configureTestingModule({
      imports: [OrgNavSectionComponent, NavigationModule],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        provideRouter([{ path: "organizations/:organizationId/vault", children: [] }]),
        // Declared after `provideRouter`, which registers its own root `ActivatedRoute`. The
        // component reads the organization layout's route, which the root route cannot stand in for.
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$, queryParamMap: queryParamMap$ },
        },
      ],
    }).compileComponents();

    // Nav items only render their text when the side nav is expanded.
    TestBed.inject(SideNavService).open.set(true);

    fixture = TestBed.createComponent(OrgNavSectionComponent);
    fixture.detectChanges();
  });

  it("lists only the organizations the user can administer, alphabetically", () => {
    expect(groupText()).toEqual(["Acme corporation", "Globex"]);
  });

  it("gives every entry a filter param, scoped to its own organization", () => {
    expect(hrefsWithin("Globex")).toEqual([
      "/organizations/org-b/vault?type=all",
      "/organizations/org-b/vault?sharedFolderId=all",
    ]);
  });

  it("links an organization with no vault access straight to its own pages", () => {
    organizations$.next([acme, noVaultAccess]);
    fixture.detectChanges();

    expect(groupText()).toEqual(["Acme corporation"]);

    const item = fixture.debugElement
      .queryAll(By.css("bit-nav-item"))
      .find((el) => el.componentInstance.text() === "Bevel co")!;
    expect(item.nativeElement.querySelector("a").getAttribute("href")).toBe("/organizations/org-d");
  });

  describe("Shared folders on URLs no link matches", () => {
    async function showVault(queryParams: Record<string, string>) {
      await TestBed.inject(Router).navigate(["/organizations/org-a/vault"], { queryParams });
      queryParamMap$.next(convertToParamMap(queryParams));
      openGroup("Acme corporation");
    }

    it("stays active while a single shared folder is selected", async () => {
      await showVault({ sharedFolderId: "shared-folder-id" });

      expect(navItem("sharedFolders")!.componentInstance.forceActiveStyles()).toBe(true);
    });

    // Where the legacy filter panel's own Shared folders entry navigates in the Admin Console.
    it("stays active on the unparameterised vault", async () => {
      await showVault({});

      expect(navItem("sharedFolders")!.componentInstance.forceActiveStyles()).toBe(true);
    });

    it("is inactive once a type filter is applied", async () => {
      await showVault({ type: "all" });

      expect(navItem("sharedFolders")!.componentInstance.forceActiveStyles()).toBe(false);
    });
  });
});
