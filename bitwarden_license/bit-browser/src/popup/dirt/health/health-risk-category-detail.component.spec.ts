import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, combineLatest, map, of } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { BitSvg, ReportExposedPasswords, LockIcon, NoCredentialsIcon } from "@bitwarden/assets/svg";
import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import {
  RiskCategory,
  VaultHealthReportStatus,
  VaultHealthReportView,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import {
  CompactModeService,
  DialogRef,
  DialogService,
  ScrollLayoutHostDirective,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { HealthDeleteAtRiskItemDialogComponent } from "./health-delete-at-risk-item-dialog.component";
import { HealthRiskCategoryDetailComponent } from "./health-risk-category-detail.component";
import { HealthScanErrorComponent } from "./health-scan-error.component";
import { HealthScanningComponent } from "./health-scanning.component";

// eslint-disable-next-line no-console
const originalError = console.error;

// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "object" &&
    (args[0] as Error).message.includes("Could not parse CSS stylesheet")
  ) {
    // Opening the menu's overlay container in tests causes stylesheets to be parsed, which can
    // lead to JSDOM unable to parse CSS errors. These can be ignored safely.
    return;
  }
  originalError(...args);
};

/**
 * Mirrors the real page's scroll host: the virtual scroll viewport in the page's content resolves
 * its scrollable through `ScrollLayoutService`, so without a host it has nothing to measure.
 */
@Component({
  selector: "popup-page",
  template: `<div bitScrollLayoutHost><ng-content></ng-content></div>`,
  imports: [ScrollLayoutHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupPageComponent {}

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupHeaderComponent {
  readonly pageTitle = input<string | undefined>(undefined);
  readonly showBackButton = input<string | boolean | undefined>(undefined);
}

@Component({
  selector: "app-pop-out",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopOutComponent {}

@Component({
  selector: "app-current-account",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCurrentAccountComponent {}

/** The real vault icon needs domain settings, config and environment services to resolve favicons. */
@Component({
  selector: "dirt-health-scanning",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthScanningComponent {}

@Component({
  selector: "dirt-health-scan-error",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthScanErrorComponent {
  readonly retry = output<void>();
}

@Component({
  selector: "app-vault-icon",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28231): Use Component suffix
// eslint-disable-next-line @angular-eslint/component-class-suffix
class MockAppVaultIcon {
  readonly cipher = input<CipherView | undefined>(undefined);
}

/** The route param, and the content the page is expected to render for it. */
const categories = [
  {
    category: RiskCategory.Exposed,
    titleKey: "exposedPasswordsTitle",
    descriptionKey: "exposedPasswordsDescription",
    emptyKey: "exposedPasswordsEmpty",
    icon: ReportExposedPasswords,
  },
  {
    category: RiskCategory.Weak,
    titleKey: "weakPasswordsTitle",
    descriptionKey: "weakPasswordsDescription",
    emptyKey: "weakPasswordEmpty",
    icon: LockIcon,
  },
  {
    category: RiskCategory.Reused,
    titleKey: "reusedPasswordsTitle",
    descriptionKey: "reusedPasswordsDescription",
    emptyKey: "reusedPasswordEmpty",
    icon: NoCredentialsIcon,
  },
] as const;

describe("HealthRiskCategoryDetailComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthRiskCategoryDetailComponent>;
  let params$: BehaviorSubject<Params>;
  let report$: BehaviorSubject<VaultHealthReportView | null>;
  /** Overrides the status the report mock derives; null means derive it. */
  let status$: BehaviorSubject<VaultHealthReportStatus | null>;
  let cipherViews$: BehaviorSubject<CipherView[]>;
  let compactEnabled$: BehaviorSubject<boolean>;
  let logService: MockProxy<LogService>;
  let reportService: MockProxy<VaultHealthReportService>;
  let cipherService: MockProxy<CipherService>;
  let router: MockProxy<Router>;
  let changeLoginPasswordService: MockProxy<ChangeLoginPasswordService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let dialogService: MockProxy<DialogService>;
  let compactModeService: MockProxy<CompactModeService>;

  /**
   * `login.uri` is a getter over `login.uris`, so fixtures have to be real views — an object
   * literal cast to `CipherView` would exercise a shape production never produces.
   */
  function buildLogin(args: {
    id: string;
    name?: string;
    username?: string;
    uris?: string[];
  }): CipherView {
    const cipher = new CipherView();
    cipher.id = args.id;
    cipher.name = args.name ?? args.id;
    cipher.type = CipherType.Login;
    cipher.login.username = args.username ?? `${args.id}@example.com`;
    cipher.login.uris = (args.uris ?? []).map((uri) => {
      const loginUri = new LoginUriView();
      loginUri.uri = uri;
      return loginUri;
    });
    return cipher;
  }

  /** A health view flagging one cipher in exactly one category. */
  function buildHealth(cipherId: string, category: RiskCategory): CipherHealthView {
    return new CipherHealthView({
      cipherId,
      hasExposedPassword: category === RiskCategory.Exposed,
      hasWeakPassword: category === RiskCategory.Weak,
      hasReusedPassword: category === RiskCategory.Reused,
      exposedCount: category === RiskCategory.Exposed ? 3 : 0,
      reuseCount: category === RiskCategory.Reused ? 2 : 0,
    });
  }

  /**
   * Publishes a report placing the given logins in one category's bucket, and the
   * logins themselves on the cipher stream the page joins against — the report
   * carries health views only, so both halves are needed to render a row. The
   * page reads only the bucket its route names, so items land in exactly one.
   */
  function setReport(category: RiskCategory, ciphers: CipherView[]) {
    const items = ciphers.map((cipher) => buildHealth(cipher.id, category));

    cipherViews$.next(ciphers);
    report$.next(
      new VaultHealthReportView({
        totalCount: items.length,
        atRiskCount: items.length,
        categoryItems: { exposed: [], weak: [], reused: [], [category]: items },
      }),
    );
  }

  /** Creates the component and flushes the microtasks that resolve the report stream. */
  async function initComponent() {
    fixture = TestBed.createComponent(HealthRiskCategoryDetailComponent);
    fixture.detectChanges();
    await settle();
  }

  /** The localized title handed to the page header. */
  function pageTitle(): string | undefined {
    return fixture.debugElement.query(By.css("popup-header")).componentInstance.pageTitle();
  }

  /** All rendered text. The i18n mock echoes keys, so keys are matched directly. */
  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-item"));
  }

  /** The scan progress view, rendered while a scan is in flight. */
  function scanning(): HTMLElement | null {
    return fixture.nativeElement.querySelector("dirt-health-scanning");
  }

  /** The scan failure view, rendered when a scan does not complete. */
  function scanError(): HTMLElement | null {
    return fixture.nativeElement.querySelector("dirt-health-scan-error");
  }

  /** The scan failure view's instance, for driving its retry output. */
  function scanErrorComponent(): MockHealthScanErrorComponent | null {
    const el = fixture.debugElement.query((n) => n.name === "dirt-health-scan-error");
    return el ? (el.componentInstance as MockHealthScanErrorComponent) : null;
  }

  /** Settles pending work and re-renders. */
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    // The virtual scroll viewport defers its own init by a microtask, so the rows it renders are
    // only in the DOM after the pass that follows that microtask. The viewport is created the
    // first time the list is shown, which can be any of these settles.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Settles, having first waited out the vault-change debounce inside
   * HealthScanService. Real timers, so the fixture's stability tracking is
   * left alone.
   */
  async function settleRefresh() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();
  }

  function rowButton(index: number): HTMLButtonElement {
    return rows()[index].querySelector("button[bit-item-content]")!;
  }

  /** The icon bound to the empty state, read off the component input rather than the rendered SVG. */
  function noItemsIcon(): BitSvg | undefined {
    return fixture.debugElement
      .query(By.css("bit-status-lockup bit-svg"))
      ?.componentInstance.content();
  }

  /** The row's change password CTA, or `undefined` when the row does not render one. */
  function changePasswordButton(index: number): HTMLButtonElement | undefined {
    return Array.from(
      rows()[index].querySelectorAll<HTMLButtonElement>("bit-item-action button"),
    ).find((button) => button.textContent?.includes("changePassword"));
  }

  /**
   * The row's ellipsis trigger. Matched on `bitIconButton` — the menu trigger is bound as a
   * property, so `bitMenuTriggerFor` never reaches the DOM.
   */
  function moreOptionsButton(index: number): HTMLButtonElement | null {
    return rows()[index].querySelector("button[bitIconButton]");
  }

  /**
   * The open menu panel. The menu's content is projected through an `ng-template` into a CDK
   * overlay, so it lives outside the fixture and is only in the DOM while the menu is open.
   */
  function menuPanel(): HTMLElement | null {
    return document.querySelector(".bit-menu-panel");
  }

  /** An entry in the open menu, matched on its rendered text. */
  function menuItem(label: string): HTMLButtonElement | undefined {
    return Array.from(menuPanel()?.querySelectorAll<HTMLButtonElement>("[bitMenuItem]") ?? []).find(
      (button) => button.textContent?.includes(label),
    );
  }

  /** Opens the ellipsis menu on the given row. */
  function openMenu(index: number) {
    moreOptionsButton(index)!.click();
    fixture.detectChanges();
  }

  /** The count rendered alongside the section header. */
  function itemCount(): string | undefined {
    return fixture.nativeElement.querySelector("bit-section-header span[slot=end]")?.textContent;
  }

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ category: RiskCategory.Exposed });

    report$ = new BehaviorSubject<VaultHealthReportView | null>(null);
    status$ = new BehaviorSubject<VaultHealthReportStatus | null>(null);
    reportService = mock<VaultHealthReportService>();
    // The service emits { status, report }. By default a present report reads as
    // success and a null one as idle; a test that needs loading or error sets
    // status$ explicitly.
    reportService.getVaultHealthReport$.mockReturnValue(
      combineLatest([report$, status$]).pipe(
        map(([report, status]) => ({
          status:
            status ?? (report ? VaultHealthReportStatus.Success : VaultHealthReportStatus.Idle),
          report,
        })),
      ),
    );
    reportService.buildVaultHealthReport.mockResolvedValue(undefined);
    // The auto-mock returns undefined, which the refresh pipeline cannot consume.
    reportService.refreshVaultHealthReport.mockResolvedValue(undefined);

    cipherViews$ = new BehaviorSubject<CipherView[]>([]);
    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(cipherViews$);

    setReport(RiskCategory.Exposed, [
      buildLogin({ id: "cipher-1", name: "Item 1", uris: ["https://example.com"] }),
    ]);

    logService = mock<LogService>();

    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    changeLoginPasswordService = mock<ChangeLoginPasswordService>();
    changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
      "https://example.com/settings/password",
    );

    passwordRepromptService = mock<PasswordRepromptService>();
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.launchUri.mockImplementation(() => {});
    // `onDeleteItem` only awaits `open()`, so a minimal `DialogRef`-shaped return is enough.
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue({ closed: of(undefined) } as DialogRef<unknown>);

    // `enabled$` is a property, not a method, so the mock has to hold the stream itself.
    compactEnabled$ = new BehaviorSubject<boolean>(false);
    compactModeService = mock<CompactModeService>();
    compactModeService.enabled$ = compactEnabled$;

    await TestBed.configureTestingModule({
      imports: [HealthRiskCategoryDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: params$ } },
        { provide: Router, useValue: router },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: userId } as Account) },
        },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: CipherService, useValue: cipherService },
        { provide: ChangeLoginPasswordService, useValue: changeLoginPasswordService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: LogService, useValue: logService },
        { provide: CompactModeService, useValue: compactModeService },
      ],
    })
      .overrideComponent(HealthRiskCategoryDetailComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            AppVaultIconComponent,
            HealthScanningComponent,
            HealthScanErrorComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
            MockAppVaultIcon,
            MockHealthScanningComponent,
            MockHealthScanErrorComponent,
          ],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    // Overlays are attached to the document body, so they outlive the fixture unless removed.
    document.querySelectorAll(".cdk-overlay-container").forEach((overlay) => overlay.remove());
  });

  describe("category content", () => {
    it.each(categories.map((c) => [c.category, c.titleKey] as const))(
      "renders the %s title in the page header",
      async (category, titleKey) => {
        params$.next({ category });

        await initComponent();

        expect(pageTitle()).toBe(titleKey);
      },
    );

    it.each(categories.map((c) => [c.category, c.descriptionKey] as const))(
      "renders the %s description when the category has items",
      async (category, descriptionKey) => {
        params$.next({ category });
        setReport(category, [buildLogin({ id: "cipher-1" })]);

        await initComponent();

        expect(text()).toContain(descriptionKey);
      },
    );

    it.each(categories.map((c) => [c.category, c.emptyKey] as const))(
      "renders the %s empty copy when the category has no items",
      async (category, emptyKey) => {
        params$.next({ category });
        setReport(category, []);

        await initComponent();

        expect(text()).toContain(emptyKey);
      },
    );

    it.each(categories.map((c) => c.category))(
      "shows only the %s bucket, not the logins at risk in other categories",
      async (category) => {
        // Highest-risk-wins means each login sits in exactly one bucket, so a
        // category page must not pick up the report's other two.
        params$.next({ category });
        const inCategory = buildLogin({ id: "in-category", name: "In category" });
        const other = buildLogin({ id: "other", name: "Other category" });
        setReport(category, [inCategory]);
        const otherCategory = categories.find((c) => c.category !== category)!.category;
        const report = report$.value!;
        report.categoryItems[otherCategory] = [buildHealth("other", otherCategory)];
        // Both logins are in the vault; only the routed bucket may render one.
        cipherViews$.next([inCategory, other]);

        await initComponent();

        expect(rows()).toHaveLength(1);
        expect(text()).toContain("In category");
        expect(text()).not.toContain("Other category");
      },
    );

    it("swaps the title, description and empty icon when the category changes", async () => {
      params$.next({ category: RiskCategory.Exposed });
      await initComponent();
      expect(pageTitle()).toBe("exposedPasswordsTitle");
      expect(text()).toContain("exposedPasswordsDescription");

      setReport(RiskCategory.Reused, [buildLogin({ id: "cipher-1" })]);
      params$.next({ category: RiskCategory.Reused });
      fixture.detectChanges();

      expect(pageTitle()).toBe("reusedPasswordsTitle");
      expect(text()).toContain("reusedPasswordsDescription");
      expect(text()).not.toContain("exposedPasswordsDescription");

      setReport(RiskCategory.Reused, []);
      fixture.detectChanges();

      expect(noItemsIcon()).toBe(NoCredentialsIcon);
    });
  });

  it("reads the report for the active account", async () => {
    await initComponent();

    expect(reportService.getVaultHealthReport$).toHaveBeenCalledWith(userId);
  });

  it("reads the ciphers it joins the report against for the active account", async () => {
    await initComponent();

    expect(cipherService.cipherViews$).toHaveBeenCalledWith(userId);
  });

  it("re-renders a row when its cipher changes in the vault", async () => {
    setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1", name: "Before" })]);
    await initComponent();
    expect(text()).toContain("Before");

    // The report holds ids only, so a rename has to reach the row through the
    // cipher stream rather than a rebuilt report.
    cipherViews$.next([buildLogin({ id: "cipher-1", name: "After" })]);
    fixture.detectChanges();

    expect(text()).toContain("After");
    expect(text()).not.toContain("Before");
  });

  describe("without a report", () => {
    beforeEach(() => {
      report$.next(null);
    });

    it("stays put instead of routing back to the health overview", async () => {
      // The popup restores the last route, so this page can be the first thing the
      // user sees. Ejecting them to the overview read as a crash.
      await initComponent();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("runs a scan and shows the progress view while it runs", async () => {
      await initComponent();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(scanning()).not.toBeNull();
      expect(rows()).toHaveLength(0);
    });

    it("renders the category once that scan succeeds", async () => {
      await initComponent();

      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1", name: "Restored" })]);
      await settle();

      expect(scanning()).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(text()).toContain("Restored");
    });

    it("shows the failure view when the scan does not complete", async () => {
      status$.next(VaultHealthReportStatus.Error);

      await initComponent();

      expect(scanError()).not.toBeNull();
      expect(scanning()).toBeNull();
    });

    it("starts another scan when the failure view is retried", async () => {
      status$.next(VaultHealthReportStatus.Error);
      await initComponent();
      reportService.buildVaultHealthReport.mockClear();

      scanErrorComponent()!.retry.emit();
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });
  });

  describe("with a report already published", () => {
    it("does not re-run the scan, so navigating in does not repeat the breach lookups", async () => {
      await initComponent();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
      expect(text()).toContain("Item 1");
    });

    it("shows the progress view while a scan is running", async () => {
      status$.next(VaultHealthReportStatus.Loading);

      await initComponent();

      expect(scanning()).not.toBeNull();
    });

    it("keeps the list on screen with no progress view while a vault change is applied", async () => {
      await initComponent();

      cipherViews$.next([
        buildLogin({ id: "cipher-1", name: "Item 1" }),
        buildLogin({ id: "new" }),
      ]);
      await settleRefresh();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalled();
      expect(scanning()).toBeNull();
      expect(text()).toContain("Item 1");
    });

    it("refreshes the report when a listed login is deleted", async () => {
      // The delete dialog no longer touches the report. It soft deletes, which sets
      // deletedDate on the cipher, and the report drops the row on the next refresh
      // because its scope filter excludes deleted logins.
      await initComponent();
      await settleRefresh();
      reportService.refreshVaultHealthReport.mockClear();

      const deleted = buildLogin({ id: "cipher-1", name: "Item 1" });
      deleted.deletedDate = new Date();
      cipherViews$.next([deleted]);
      await settleRefresh();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith([deleted], userId);
    });

    it("stops watching the vault once the page is destroyed", async () => {
      await initComponent();
      await settleRefresh();
      reportService.refreshVaultHealthReport.mockClear();

      fixture.destroy();
      cipherViews$.next([buildLogin({ id: "other" })]);
      await settleRefresh();

      expect(reportService.refreshVaultHealthReport).not.toHaveBeenCalled();
    });
  });

  describe("with an invalid category", () => {
    it("routes no value provided back to the health overview", async () => {
      params$.next({ category: undefined });

      await initComponent();

      expect(router.navigate).toHaveBeenCalledWith(["/tabs/health"]);
    });

    it("routes invalid value back to the health overview", async () => {
      params$.next({ category: "invalid" });

      await initComponent();

      expect(router.navigate).toHaveBeenCalledWith(["/tabs/health"]);
    });
  });

  describe("item list", () => {
    it("renders a row per item", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", name: "Item 1" }),
        buildLogin({ id: "cipher-2", name: "Item 2" }),
      ]);

      await initComponent();

      expect(rows()).toHaveLength(2);
      expect(text()).toContain("Item 1");
      expect(text()).toContain("Item 2");
    });

    it("renders each item's username", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", username: "person@example.com" }),
      ]);

      await initComponent();

      expect(text()).toContain("person@example.com");
    });

    it("renders the item count alongside the section header", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);

      await initComponent();

      expect(itemCount()).toContain("3");
    });
  });

  describe("viewing an item", () => {
    it("routes to the cipher when a row is clicked", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);
      await initComponent();

      rowButton(1).click();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["/view-cipher"], {
        queryParams: { cipherId: "cipher-2", type: CipherType.Login },
      });
    });

    it("checks the master password reprompt for the clicked cipher", async () => {
      await initComponent();

      rowButton(0).click();
      await fixture.whenStable();

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-1" }),
      );
    });

    it("does not route when the master password reprompt is not satisfied", async () => {
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
      await initComponent();

      rowButton(0).click();
      await fixture.whenStable();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    beforeEach(() => {
      setReport(RiskCategory.Exposed, []);
    });

    it.each(categories.map((c) => [c.category, c.icon] as const))(
      "renders the %s empty state icon",
      async (category, icon) => {
        params$.next({ category });

        await initComponent();

        expect(noItemsIcon()).toBe(icon);
      },
    );

    it("renders the shared empty state title", async () => {
      await initComponent();

      expect(text()).toContain("youreAllSet");
    });

    it("replaces the item list and count with the empty state", async () => {
      await initComponent();

      expect(rows()).toHaveLength(0);
      expect(itemCount()).toBeUndefined();
      expect(text()).not.toContain("exposedPasswordsDescription");
    });
  });

  describe("change password", () => {
    it("renders the change password button for an item with a URI", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", uris: ["https://example.com"] }),
      ]);

      await initComponent();

      expect(changePasswordButton(0)).toBeDefined();
    });

    it("does not render the change password button for an item without a URI", async () => {
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1", uris: [] })]);

      await initComponent();

      expect(rows()).toHaveLength(1);
      expect(changePasswordButton(0)).toBeUndefined();
    });

    it("opens the change password URL for the clicked item using platform utils service", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1", uris: ["https://example.com"] }),
        buildLogin({ id: "cipher-2", uris: ["https://another.example.com"] }),
      ]);
      changeLoginPasswordService.getChangePasswordUrl.mockResolvedValue(
        "https://another.example.com/password",
      );
      await initComponent();

      changePasswordButton(1)!.click();
      await fixture.whenStable();

      expect(changeLoginPasswordService.getChangePasswordUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-2" }),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://another.example.com/password",
      );
    });
  });

  describe("ellipsis menu", () => {
    it("renders an ellipsis menu trigger on every row", async () => {
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
      ]);

      await initComponent();

      expect(moreOptionsButton(0)).not.toBeNull();
      expect(moreOptionsButton(1)).not.toBeNull();
      expect(moreOptionsButton(0)!.getAttribute("aria-label")).toBe("options");
    });

    it("renders the delete item entry in the ellipsis menu", async () => {
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1" })]);
      await initComponent();

      openMenu(0);

      expect(menuPanel()).not.toBeNull();
      expect(menuItem("deleteItem")).toBeDefined();
    });

    it("checks the master password reprompt for the delete item", async () => {
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1" })]);
      await initComponent();
      openMenu(0);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();
      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-1" }),
      );
    });

    it("delete dialog is not opened when the master password reprompt is not satisfied", async () => {
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1" })]);
      await initComponent();
      openMenu(0);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();

      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("opens the delete dialog when the menu entry is clicked", async () => {
      setReport(RiskCategory.Exposed, [buildLogin({ id: "cipher-1" })]);
      await initComponent();
      openMenu(0);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledWith(
        HealthDeleteAtRiskItemDialogComponent,
        expect.anything(),
      );
    });

    // The risk flags on the passed view are placeholders today, so only the item's identity and
    // the category are asserted — the hierarchy they drive is covered in the dialog's own spec.
    it("passes the clicked item and the current category to the dialog", async () => {
      params$.next({ category: RiskCategory.Exposed });
      setReport(RiskCategory.Exposed, [
        buildLogin({ id: "cipher-1" }),
        buildLogin({ id: "cipher-2" }),
        buildLogin({ id: "cipher-3" }),
      ]);
      await initComponent();
      openMenu(1);

      menuItem("deleteItem")!.click();
      await fixture.whenStable();

      expect(dialogService.open).toHaveBeenCalledWith(
        HealthDeleteAtRiskItemDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            currentCategory: RiskCategory.Exposed,
            item: expect.objectContaining({ cipherId: "cipher-2" }),
          }),
        }),
      );
    });
  });
});
