import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { NavigationModule, SideNavService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { ARCHIVE_ROUTE, TRASH_ROUTE } from "../../models/vault-scope";

import { VaultManageNavComponent } from "./vault-manage-nav.component";

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

describe("VaultManageNavComponent", () => {
  const userId = "user-id" as UserId;

  let fixture: ComponentFixture<VaultManageNavComponent>;
  let router: Router;

  const canArchive$ = new BehaviorSubject<boolean>(true);
  const archivedCiphers$ = new BehaviorSubject<unknown[]>([]);

  const i18nService = mock<I18nService>();
  const cipherArchiveService = mock<CipherArchiveService>();
  const premiumUpgradePromptService = mock<PremiumUpgradePromptService>();

  const navItem = (text: string) =>
    fixture.debugElement
      .queryAll(By.css("bit-nav-item"))
      .find((el) => el.componentInstance.text() === text);

  const clickNavItem = (text: string) =>
    navItem(text).nativeElement.querySelector("button, a")?.dispatchEvent(new MouseEvent("click"));

  beforeEach(async () => {
    jest.clearAllMocks();
    canArchive$.next(true);
    archivedCiphers$.next([]);

    i18nService.t.mockImplementation((key: string) => key);
    cipherArchiveService.userCanArchive$.mockReturnValue(canArchive$);
    cipherArchiveService.archivedCiphers$.mockReturnValue(archivedCiphers$ as never);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    await TestBed.configureTestingModule({
      imports: [
        VaultManageNavComponent,
        NavigationModule,
        // Real routes so `archiveActive` can be exercised by navigating rather than by stubbing
        // the router state it reads.
        RouterModule.forRoot([
          { path: `vault/${ARCHIVE_ROUTE}`, children: [] },
          { path: `vault/${TRASH_ROUTE}`, children: [] },
        ]),
      ],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();

    // Nav items only render their text when the side nav is expanded.
    TestBed.inject(SideNavService).open.set(true);

    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(VaultManageNavComponent);
    fixture.detectChanges();
  });

  it("renders My folders, Archive and Trash in order", () => {
    const text = fixture.debugElement
      .queryAll(By.css("bit-nav-item"))
      .map((el) => el.componentInstance.text());

    expect(text).toEqual(["myFolders", "archiveNoun", "trash"]);
  });

  it("links Trash to the trash vault scope", () => {
    expect(navItem("trash").componentInstance.route()).toEqual(["/vault", TRASH_ROUTE]);
  });

  describe("Archive upgrade path", () => {
    it("prompts to upgrade when a user who cannot archive has nothing archived", async () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      canArchive$.next(false);
      fixture.detectChanges();

      clickNavItem("archiveNoun");
      await fixture.whenStable();

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("still navigates to the archive when a user who cannot archive has archived items", async () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      canArchive$.next(false);
      archivedCiphers$.next([{}]);
      fixture.detectChanges();

      clickNavItem("archiveNoun");
      await fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith(["/vault", ARCHIVE_ROUTE]);
      expect(premiumUpgradePromptService.promptForPremium).not.toHaveBeenCalled();
    });

    it("badges Archive for a non-premium user", () => {
      expect(fixture.nativeElement.querySelector("button[bit-chip-action]")).toBeNull();

      canArchive$.next(false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("button[bit-chip-action]")).not.toBeNull();
    });
  });

  describe("clicking the entry for the page in view", () => {
    // PM-42525.
    const trashWithFilters = `/vault/${TRASH_ROUTE}?vault.sort=name&vault.direction=asc`;

    it("leaves Trash's query params in the URL", async () => {
      await router.navigateByUrl(trashWithFilters);
      fixture.detectChanges();

      clickNavItem("trash");
      await fixture.whenStable();

      expect(router.url).toBe(trashWithFilters);
    });

    it("carries no query params from Trash onto the archive", async () => {
      await router.navigateByUrl(trashWithFilters);
      fixture.detectChanges();

      clickNavItem("archiveNoun");
      await fixture.whenStable();

      expect(router.url).toBe(`/vault/${ARCHIVE_ROUTE}`);
    });

    it("does not re-navigate to the archive from the archive", async () => {
      await router.navigateByUrl(`/vault/${ARCHIVE_ROUTE}?vault.sort=name`);
      fixture.detectChanges();
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      clickNavItem("archiveNoun");
      await fixture.whenStable();

      expect(navigate).not.toHaveBeenCalled();
      expect(router.url).toBe(`/vault/${ARCHIVE_ROUTE}?vault.sort=name`);
    });

    it("does not prompt to upgrade when a non-premium user re-clicks the archive", async () => {
      // The early return lands before the upgrade check, so being here already outranks it.
      await router.navigateByUrl(`/vault/${ARCHIVE_ROUTE}`);
      canArchive$.next(false);
      fixture.detectChanges();

      clickNavItem("archiveNoun");
      await fixture.whenStable();

      expect(premiumUpgradePromptService.promptForPremium).not.toHaveBeenCalled();
    });
  });

  it("marks Archive as the current page for assistive technology", async () => {
    // Archive is a button, so `routerLinkActive` never writes `aria-current` for it.
    const ariaCurrent = () =>
      navItem("archiveNoun").nativeElement.querySelector("button")?.getAttribute("aria-current");

    expect(ariaCurrent()).toBeNull();

    await router.navigateByUrl(`/vault/${ARCHIVE_ROUTE}`);
    fixture.detectChanges();

    expect(ariaCurrent()).toBe("page");
  });

  it("highlights Archive only while the archive is the current page", async () => {
    expect(navItem("archiveNoun").componentInstance.forceActiveStyles()).toBe(false);

    await router.navigateByUrl(`/vault/${ARCHIVE_ROUTE}`);
    fixture.detectChanges();

    expect(navItem("archiveNoun").componentInstance.forceActiveStyles()).toBe(true);

    await router.navigateByUrl(`/vault/${TRASH_ROUTE}`);
    fixture.detectChanges();

    expect(navItem("archiveNoun").componentInstance.forceActiveStyles()).toBe(false);
  });
});
