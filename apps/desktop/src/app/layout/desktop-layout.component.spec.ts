import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  DialogService,
  LayoutComponent,
  NavigationModule,
  SideNavService,
} from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { GlobalStateProvider } from "@bitwarden/state";
import { VaultNavItemType, VaultNavService, VaultsNavViewModel } from "@bitwarden/vault";

import { AccountSwitcherV2Component } from "../../auth/components/account-switcher/account-switcher-v2.component";
import { VaultFilterComponent } from "../../vault/app/vault-v3/vault-filter/vault-filter.component";
import { ImportDesktopComponent } from "../tools/import/import-desktop.component";
import { SendFiltersNavComponent } from "../tools/send/send-filters-nav.component";

import { DesktopLayoutComponent } from "./desktop-layout.component";
import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// Mock the child component to isolate DesktopLayoutComponent testing
@Component({
  selector: "app-send-filters-nav",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSendFiltersNavComponent {}

@Component({
  selector: "app-vault-filter",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockVaultFiltersNavComponent {}

// Mock ResizeObserver
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

describe("DesktopLayoutComponent", () => {
  let component: DesktopLayoutComponent;
  let fixture: ComponentFixture<DesktopLayoutComponent>;
  let router: Router;

  const userId = "user-id" as UserId;
  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

  const flag$ = new BehaviorSubject<boolean>(false);
  const importUpgradeFlag$ = new BehaviorSubject<boolean>(false);
  const viewModel$ = new BehaviorSubject<VaultsNavViewModel>({
    vaults: [
      {
        id: userId,
        label: "myVault",
        color: "brand",
        icon: "bwi-user",
        type: VaultNavItemType.Personal,
        enabled: true,
      },
      {
        id: "org-id",
        label: "Acme",
        color: "purple",
        icon: "bwi-business",
        type: VaultNavItemType.Organization,
        enabled: true,
      },
    ],
    organizationDataOwnership: false,
  });
  const canArchive$ = new BehaviorSubject<boolean>(true);
  const archivedCiphers$ = new BehaviorSubject<unknown[]>([]);

  const i18nService = mock<I18nService>();
  const vaultNavService = mock<VaultNavService>();
  const cipherArchiveService = mock<CipherArchiveService>();
  const premiumUpgradePromptService = mock<PremiumUpgradePromptService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  /** Whether the layout was told to draw its rounded top-left corner. */
  const rounded = (f: ComponentFixture<DesktopLayoutComponent>) =>
    f.debugElement.query(By.directive(LayoutComponent)).componentInstance.rounded();

  /** Trimmed text of every rendered nav item, group, and section heading, in document order. */
  const navText = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("bit-nav-item, bit-nav-group, bit-nav-section"),
    )
      .map((el) => {
        const element = el as HTMLElement;
        // Sections render their heading as a sibling of the projected items, so read the heading directly.
        if (element.tagName.toLowerCase() === "bit-nav-section") {
          return element.querySelector("[id^='bit-nav-section-']")?.textContent?.trim();
        }
        // A group composes its own row from a nav item; the group already reports that text.
        if (element.parentElement?.tagName.toLowerCase() === "bit-nav-group") {
          return undefined;
        }
        return element.textContent?.trim().split("\n")[0].trim();
      })
      .filter((text) => text !== undefined);

  /** The "Import" bit-nav-item, found by rendered text since NavItemComponent isn't part of
   *  @bitwarden/components' public barrel. Throws on no match instead of a TypeError in callers. */
  const importNavItem = (): HTMLElement => {
    const element = Array.from(fixture.nativeElement.querySelectorAll("bit-nav-item")).find(
      (el) => (el as HTMLElement).textContent?.trim().split("\n")[0].trim() === "importNoun",
    ) as HTMLElement | undefined;
    if (!element) {
      throw new Error(
        'No bit-nav-item found with first-line text "importNoun" — check the i18n mock or the rendered nav text.',
      );
    }
    return element;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    flag$.next(false);
    importUpgradeFlag$.next(false);
    canArchive$.next(true);
    archivedCiphers$.next([]);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag: FeatureFlag) =>
      flag === FeatureFlag.ImportUpgrade ? importUpgradeFlag$ : flag$,
    );

    i18nService.t.mockImplementation((key: string) => key);
    platformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);
    cipherArchiveService.userCanArchive$.mockReturnValue(canArchive$);
    cipherArchiveService.archivedCiphers$.mockReturnValue(archivedCiphers$ as any);
    vaultNavService.viewModel$.mockReturnValue(viewModel$);

    await TestBed.configureTestingModule({
      imports: [DesktopLayoutComponent, RouterModule.forRoot([]), NavigationModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: GlobalStateProvider, useValue: fakeGlobalStateProvider },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: SendPolicyService, useValue: { disableSend$: of(false) } },
        { provide: ConfigService, useValue: configService },
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    })
      .overrideComponent(DesktopLayoutComponent, {
        remove: { imports: [SendFiltersNavComponent, VaultFilterComponent] },
        add: { imports: [MockSendFiltersNavComponent, MockVaultFiltersNavComponent] },
      })
      .overrideComponent(DesktopSideNavComponent, {
        remove: { imports: [AccountSwitcherV2Component] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);

    // Nav items only render their text when the side nav is expanded. The layout's
    // ResizeObserver is stubbed out, so it measures a zero-width container and would
    // collapse the nav on the next change detection without an explicit preference.
    const sideNavService = TestBed.inject(SideNavService);
    sideNavService.userCollapsePreference.set("open");
    sideNavService.open.set(true);

    fixture = TestBed.createComponent(DesktopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  it("renders bit-layout component", () => {
    const compiled = fixture.nativeElement;
    const layoutElement = compiled.querySelector("bit-layout");

    expect(layoutElement).toBeTruthy();
  });

  it("supports content projection for side-nav", () => {
    const compiled = fixture.nativeElement;
    const ngContent = compiled.querySelectorAll("ng-content");

    expect(ngContent).toBeTruthy();
  });

  describe("flag off", () => {
    it("renders the current navigation unchanged", () => {
      expect(fixture.nativeElement.querySelector("app-vault-filter")).toBeTruthy();
      expect(fixture.nativeElement.querySelector("app-send-filters-nav")).toBeTruthy();
      expect(navText()).toEqual(["generator", "importNoun", "exportNoun"]);
    });
  });

  describe("flag on", () => {
    beforeEach(() => {
      flag$.next(true);
      fixture.detectChanges();
    });

    it("drops the old vault filter and renders the new sections", () => {
      expect(fixture.nativeElement.querySelector("app-vault-filter")).toBeNull();
      expect(navText()).toEqual([
        "allItems",
        "vaults",
        "myVault",
        "Acme",
        "tools",
        "generator",
        "exportNoun",
        "manage",
        "myFolders",
        "archiveNoun",
        "trash",
      ]);
    });

    it("keeps Send in Tools", () => {
      expect(fixture.nativeElement.querySelector("app-send-filters-nav")).toBeTruthy();
    });

    it("rounds the layout on macOS", () => {
      expect(rounded(fixture)).toBe(true);
    });

    it.each([DeviceType.WindowsDesktop, DeviceType.LinuxDesktop])(
      "does not round the layout on device type %i",
      (deviceType) => {
        platformUtilsService.getDevice.mockReturnValue(deviceType);

        const nonMacFixture = TestBed.createComponent(DesktopLayoutComponent);
        nonMacFixture.detectChanges();

        expect(rounded(nonMacFixture)).toBe(false);
      },
    );
  });

  describe("openImport", () => {
    it("opens the legacy import dialog when the import upgrade flag is off", () => {
      const dialogService = TestBed.inject(DialogService);
      const router = TestBed.inject(Router);
      jest.spyOn(router, "navigate");

      component["openImport"]();

      expect(dialogService.open).toHaveBeenCalledWith(ImportDesktopComponent);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does nothing when the import upgrade flag is on, leaving navigation to the nav item's own route binding", () => {
      importUpgradeFlag$.next(true);
      fixture.detectChanges();
      const dialogService = TestBed.inject(DialogService);
      const router = TestBed.inject(Router);
      jest.spyOn(router, "navigate");

      component["openImport"]();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("never disagrees with the nav item's own route binding about whether the flag is on", () => {
      expect(component["importUpgradeEnabled"]()).toBe(false);
      expect(importNavItem().querySelector("a")).toBeNull();

      importUpgradeFlag$.next(true);
      fixture.detectChanges();

      expect(component["importUpgradeEnabled"]()).toBe(true);
      expect(importNavItem().querySelector("a")).toBeTruthy();
    });
  });

  describe("import nav item active-state wiring", () => {
    it("renders as a plain button, with no route to be active against, when the import upgrade flag is off", () => {
      expect(importNavItem().querySelector("a")).toBeNull();
      expect(importNavItem().querySelector("button")).toBeTruthy();
    });

    it("renders as a routed link, so routerLinkActive can highlight it, when the import upgrade flag is on", () => {
      importUpgradeFlag$.next(true);
      fixture.detectChanges();

      expect(importNavItem().querySelector("a")).toBeTruthy();
      expect(importNavItem().querySelector("button")).toBeNull();
    });
  });
});
