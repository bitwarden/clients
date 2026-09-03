import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, map, of, ReplaySubject, Subject, throwError } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
  VaultHealthReportStatus,
  VaultHealthReportView,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { HealthOverviewComponent } from "./health-overview.component";
import { HealthScanErrorComponent } from "./health-scan-error.component";
import { HealthScanningComponent } from "./health-scanning.component";
import { HealthComponent } from "./health.component";
import { HealthAccessService } from "./services/health-access.service";

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
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

@Component({
  selector: "dirt-health-overview",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthOverviewComponent {
  readonly report = input.required<VaultHealthReportView>();
  readonly locked = input(false);
  readonly upgrade = output<void>();
}

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

describe("HealthComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthComponent>;
  let activeAccount$: ReplaySubject<Account | null>;
  let hasBeenOpened$: BehaviorSubject<boolean>;
  let hasRunScan$: BehaviorSubject<boolean>;
  let hasPremium$: BehaviorSubject<boolean>;
  let healthAccessService: MockProxy<HealthAccessService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let dialogService: MockProxy<DialogService>;
  let cipherService: MockProxy<CipherService>;
  let reportService: MockProxy<VaultHealthReportService>;
  let logService: MockProxy<LogService>;
  /**
   * Stands in for the service's published state. Scoped by user, exactly as
   * DefaultVaultHealthReportService is, so a state published for one account is
   * invisible to the next.
   */
  let published: BehaviorSubject<({ userId: UserId } & VaultHealthReportState) | null>;

  /**
   * Makes a build publish `loading` and then `success`, mirroring the real
   * service. The publish happens before the promise resolves, exactly as the
   * implementation does it.
   */
  function publishesOnBuild(report: VaultHealthReportView) {
    reportService.buildVaultHealthReport.mockImplementation(async (_ciphers, id) => {
      published.next({ userId: id, status: VaultHealthReportStatus.Loading, report: null });
      published.next({ userId: id, status: VaultHealthReportStatus.Success, report });
    });
  }

  /**
   * Makes a build fail the way the real service does: it publishes `error` and
   * resolves, rather than rejecting.
   */
  function publishesErrorOnBuild() {
    reportService.buildVaultHealthReport.mockImplementation(async (_ciphers, id) => {
      published.next({ userId: id, status: VaultHealthReportStatus.Loading, report: null });
      published.next({ userId: id, status: VaultHealthReportStatus.Error, report: null });
    });
  }

  /** Leaves a build in flight forever, so generation never completes. */
  function buildNeverSettles() {
    reportService.buildVaultHealthReport.mockImplementation((_ciphers, id) => {
      published.next({ userId: id, status: VaultHealthReportStatus.Loading, report: null });
      return new Promise<void>(() => {});
    });
  }

  /** Creates the component and flushes the microtask that writes the state. */
  async function initComponent() {
    fixture = TestBed.createComponent(HealthComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The intro view, rendered until the User has run a Health scan. */
  function intro(): HTMLElement | null {
    return fixture.nativeElement.querySelector("health-intro");
  }

  /** The intro view's "Scan my vault" CTA. */
  function scanButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("health-intro button");
  }

  /** The Health Overview, rendered once a scan has succeeded. */
  function overview(): MockHealthOverviewComponent | null {
    const el = fixture.debugElement.query((n) => n.name === "dirt-health-overview");
    return el ? (el.componentInstance as MockHealthOverviewComponent) : null;
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

  /** Settles the scan pipeline and re-renders. */
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Settles, having first waited out the vault-change debounce inside
   * HealthScanService. Real timers rather than fake ones, so the scan progress
   * view's own interval and Angular's stability tracking are left alone.
   */
  async function settleRefresh() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();
  }

  beforeEach(async () => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    hasBeenOpened$ = new BehaviorSubject<boolean>(false);
    hasRunScan$ = new BehaviorSubject<boolean>(false);

    healthAccessService = mock<HealthAccessService>();
    healthAccessService.healthHasBeenOpened$.mockReturnValue(hasBeenOpened$);
    healthAccessService.hasRunHealthScan$.mockReturnValue(hasRunScan$);

    // Premium by default, so the existing tests exercise the unlocked experience.
    hasPremium$ = new BehaviorSubject<boolean>(true);
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);

    dialogService = mock<DialogService>();

    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(of([] as CipherView[]));

    reportService = mock<VaultHealthReportService>();
    // Mirror the real service: getVaultHealthReport$ replays one flat
    // { status, report } per user, so one account's state can't leak to the next.
    published = new BehaviorSubject<({ userId: UserId } & VaultHealthReportState) | null>(null);
    reportService.getVaultHealthReport$.mockImplementation((id) =>
      published.pipe(
        map((scoped) =>
          scoped?.userId === id
            ? { status: scoped.status, report: scoped.report }
            : VAULT_HEALTH_REPORT_IDLE,
        ),
      ),
    );
    publishesOnBuild(new VaultHealthReportView());
    // The auto-mock returns undefined, which the refresh pipeline cannot consume.
    reportService.refreshVaultHealthReport.mockResolvedValue(undefined);

    logService = mock<LogService>();

    await TestBed.configureTestingModule({
      imports: [HealthComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: HealthAccessService, useValue: healthAccessService },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: LogService, useValue: logService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: AbstractThemingService,
          useValue: { theme$: new BehaviorSubject(ThemeTypes.Light) },
        },
      ],
    })
      .overrideComponent(HealthComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            HealthOverviewComponent,
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
            MockHealthOverviewComponent,
            MockHealthScanningComponent,
            MockHealthScanErrorComponent,
          ],
        },
      })
      .compileComponents();
  });

  describe("intro view", () => {
    it("shows the intro when the User has not run a Health scan", async () => {
      await initComponent();

      expect(intro()).not.toBeNull();
      expect(overview()).toBeNull();
      expect(scanning()).toBeNull();
      expect(scanError()).toBeNull();
    });

    it("replaces the intro with the results once a Health scan has been run", async () => {
      await initComponent();
      expect(intro()).not.toBeNull();

      hasRunScan$.next(true);
      await settle();

      expect(intro()).toBeNull();
      expect(overview()).not.toBeNull();
    });
  });

  describe("vault scan", () => {
    it("does not start the scan until the intro's CTA has been used", async () => {
      await initComponent();

      expect(intro()).not.toBeNull();
      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();

      hasRunScan$.next(true);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });

    it("scans automatically on a later visit, with no prompt", async () => {
      hasRunScan$.next(true);

      await initComponent();
      await settle();

      expect(intro()).toBeNull();
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });

    it("shows the scan progress view while the scan is running", async () => {
      hasRunScan$.next(true);
      buildNeverSettles();

      await initComponent();
      await settle();

      expect(scanning()).not.toBeNull();
      expect(overview()).toBeNull();
      expect(scanError()).toBeNull();
    });

    it("hands the report to the Health Overview once the scan succeeds", async () => {
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

      await initComponent();
      await settle();

      expect(overview()).not.toBeNull();
      expect(overview()?.report().atRiskCount).toBe(10);
      expect(scanning()).toBeNull();
      expect(scanError()).toBeNull();
    });

    it("renders the report the service published, not a locally held copy", async () => {
      // Generation has to publish through the service, because /health/:category
      // is a sibling route rather than a child: this component is destroyed on
      // navigation, and HealthRiskCategoryDetailComponent reads the report from
      // the service alone, bouncing back here when it is null. Keeping the
      // result only in this component's own state would compile and quietly
      // break every category row, so pin the read path.
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 40, atRiskCount: 7 }));

      await initComponent();
      await settle();

      expect(reportService.getVaultHealthReport$).toHaveBeenCalledWith(userId);
      expect(overview()?.report().atRiskCount).toBe(7);
    });

    it("shows the scan failure view when report generation fails", async () => {
      // The service publishes a failure as state rather than rejecting, so this
      // is the path a real HIBP failure takes. The service logs it, not us.
      hasRunScan$.next(true);
      publishesErrorOnBuild();

      await initComponent();
      await settle();

      expect(scanError()).not.toBeNull();
      expect(overview()).toBeNull();
      expect(scanning()).toBeNull();
    });

    it("shows the scan failure view and logs when the ciphers stream fails", async () => {
      // A cipherViews$ failure never reaches the report service, so the service
      // cannot log it and cannot publish an error state for it. Without the
      // pipeline's own catch the stream would tear down and strand the user on
      // the progress view, so both halves are pinned here.
      hasRunScan$.next(true);
      cipherService.cipherViews$.mockReturnValue(
        throwError(() => new Error("ciphers unavailable")) as never,
      );

      await initComponent();
      await settle();

      expect(scanError()).not.toBeNull();
      expect(scanning()).toBeNull();
      expect(logService.error).toHaveBeenCalledWith(
        "Vault health scan pipeline failed",
        expect.anything(),
      );
    });

    it("reflects a report the service publishes after generation completed", async () => {
      // The tab follows the service's state rather than taking the first report
      // and stopping. Any later publish for this user therefore reaches the
      // overview, which is what makes an in-place report update possible at all.
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 10, atRiskCount: 4 }));

      await initComponent();
      await settle();
      expect(overview()?.report().atRiskCount).toBe(4);

      published.next({
        userId,
        status: VaultHealthReportStatus.Success,
        report: new VaultHealthReportView({ totalCount: 9, atRiskCount: 3 }),
      });
      await settle();

      expect(overview()?.report().atRiskCount).toBe(3);
    });

    it("does not scan the replayed null from cipherViews$, which would report a permanently healthy vault", async () => {
      // This is what filterOutNullish() in the scan pipeline is for, so this
      // test fails if it is ever removed as redundant. cipherViews$ is
      // shareReplay-cached with refCount: false and emits null when the
      // decrypted ciphers are cleared, so a fresh subscriber can receive null
      // FIRST. Scanning it reports an empty vault and, because take(1) then
      // completes, the user is stranded on a permanent "healthy" reading.
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[] | null>(null);
      cipherService.cipherViews$.mockReturnValue(ciphers$ as never);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 40, atRiskCount: 12 }));

      await initComponent();
      await settle();

      // Nothing should have been scanned off the null; the tab is still scanning.
      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
      expect(scanning()).not.toBeNull();

      // The real ciphers arrive; now it scans, exactly once, with those ciphers.
      const real = [{} as CipherView, {} as CipherView];
      ciphers$.next(real);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledWith(real, userId);
      expect(overview()?.report().atRiskCount).toBe(12);
    });

    it("does not show one account's report to the next after a switch", async () => {
      // The second account's scan flag is read from storage and has not
      // resolved yet, which is the window in which the previous account's
      // report could otherwise still be on screen.
      const nextUserId = Utils.newGuid() as UserId;
      const nextUserScan$ = new Subject<boolean>();
      healthAccessService.hasRunHealthScan$.mockImplementation((id) =>
        id === nextUserId ? nextUserScan$ : hasRunScan$,
      );
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

      await initComponent();
      await settle();
      expect(overview()?.report().atRiskCount).toBe(10);

      activeAccount$.next({ id: nextUserId } as Account);
      await settle();

      expect(overview()).toBeNull();
    });

    it("rescans on every load, even when the service already has a report for this user", async () => {
      // PM-39223: the scan runs on every Health Tab load with no caching. The
      // popup rebuilds this component on each navigation to Health (including
      // returning from a category detail, a sibling /health/:category route), so
      // a fresh build runs even when a prior report is already published.
      hasRunScan$.next(true);
      published.next({
        userId,
        status: VaultHealthReportStatus.Success,
        report: new VaultHealthReportView({ totalCount: 10, atRiskCount: 2 }),
      });
      publishesOnBuild(new VaultHealthReportView({ totalCount: 10, atRiskCount: 3 }));

      await initComponent();
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(overview()?.report().atRiskCount).toBe(3);
    });

    it("starts a fresh scan on load even if one was already in flight", async () => {
      // There is no in-flight reuse guard anymore: every load runs its own scan.
      // A prior build left mid-flight (the component was destroyed on nav-away)
      // does not stop the new load from starting its own.
      hasRunScan$.next(true);
      published.next({ userId, status: VaultHealthReportStatus.Loading, report: null });
      publishesOnBuild(new VaultHealthReportView({ totalCount: 8, atRiskCount: 1 }));

      await initComponent();
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(overview()?.report().atRiskCount).toBe(1);
    });

    it("retries after a previous generation failed", async () => {
      // A failed scan is not something to reuse: there is no report to preserve
      // and no build to follow. Reusing the error would put the user on the
      // failure view on arrival and make them retry by hand to see anything.
      hasRunScan$.next(true);
      published.next({ userId, status: VaultHealthReportStatus.Error, report: null });
      publishesOnBuild(new VaultHealthReportView({ totalCount: 5, atRiskCount: 1 }));

      await initComponent();
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(overview()?.report().atRiskCount).toBe(1);
    });

    it("refreshes when the vault changes, without a second full scan", async () => {
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[]>([]);
      cipherService.cipherViews$.mockReturnValue(ciphers$);
      await initComponent();
      await settleRefresh();
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      reportService.refreshVaultHealthReport.mockClear();

      const changed = [{} as CipherView];
      ciphers$.next(changed);
      await settleRefresh();

      // The changed vault is what gets rechecked, and the breach lookups of a full
      // scan are not repeated.
      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith(changed, userId);
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });

    it("shows no progress view while a vault change is applied", async () => {
      // An update the user did not ask for stays in the background: the report they
      // are reading stays on screen.
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[]>([]);
      cipherService.cipherViews$.mockReturnValue(ciphers$);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 40, atRiskCount: 12 }));
      await initComponent();
      await settleRefresh();

      ciphers$.next([{} as CipherView]);
      await settleRefresh();

      expect(scanning()).toBeNull();
      expect(overview()).not.toBeNull();
    });

    it("does not refresh before the initial scan has completed", async () => {
      // The refresh has no baseline to compare against until the scan publishes.
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[]>([]);
      cipherService.cipherViews$.mockReturnValue(ciphers$);
      buildNeverSettles();

      await initComponent();
      ciphers$.next([{} as CipherView]);
      await settleRefresh();

      expect(reportService.refreshVaultHealthReport).not.toHaveBeenCalled();
    });

    it("stops watching the vault once the tab is destroyed", async () => {
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[]>([]);
      cipherService.cipherViews$.mockReturnValue(ciphers$);
      await initComponent();
      await settleRefresh();
      reportService.refreshVaultHealthReport.mockClear();

      fixture.destroy();
      ciphers$.next([{} as CipherView]);
      await settleRefresh();

      expect(reportService.refreshVaultHealthReport).not.toHaveBeenCalled();
    });

    it("does not carry a ciphers failure from one account to the next after a switch", async () => {
      // The ciphers-failure flag clears at the start of each build, so B's successful scan is not masked by A's failure.
      const nextUserId = Utils.newGuid() as UserId;
      const nextUserScan$ = new Subject<boolean>();
      healthAccessService.hasRunHealthScan$.mockImplementation((id) =>
        id === nextUserId ? nextUserScan$ : hasRunScan$,
      );
      hasRunScan$.next(true);
      cipherService.cipherViews$.mockImplementation((id) =>
        id === userId
          ? (throwError(() => new Error("ciphers unavailable")) as never)
          : of([] as CipherView[]),
      );
      publishesOnBuild(new VaultHealthReportView({ totalCount: 5, atRiskCount: 1 }));

      await initComponent();
      await settle();
      expect(scanError()).not.toBeNull();

      // Switch to account B and let its scan complete.
      activeAccount$.next({ id: nextUserId } as Account);
      await settle();
      nextUserScan$.next(true);
      await settle();

      expect(scanError()).toBeNull();
      expect(overview()).not.toBeNull();
    });

    it("clears a prior ciphers failure when the same user scans again", async () => {
      // The ciphers-failure flag clears at the start of each build, so A's later successful scan is not masked by its earlier failure.
      const nextUserId = Utils.newGuid() as UserId;
      const nextUserScan$ = new Subject<boolean>();
      healthAccessService.hasRunHealthScan$.mockImplementation((id) =>
        id === nextUserId ? nextUserScan$ : hasRunScan$,
      );
      hasRunScan$.next(true);
      let aScans = 0;
      cipherService.cipherViews$.mockImplementation((id) => {
        if (id !== userId) {
          return of([] as CipherView[]);
        }
        aScans += 1;
        return aScans === 1
          ? (throwError(() => new Error("ciphers unavailable")) as never)
          : of([] as CipherView[]);
      });
      publishesOnBuild(new VaultHealthReportView({ totalCount: 3, atRiskCount: 1 }));

      await initComponent();
      await settle();
      expect(scanError()).not.toBeNull();

      // Switch away and back; account A's second scan succeeds.
      activeAccount$.next({ id: nextUserId } as Account);
      await settle();
      activeAccount$.next({ id: userId } as Account);
      await settle();

      expect(scanError()).toBeNull();
      expect(overview()).not.toBeNull();
    });

    it("shows the progress view on load while the rescan runs, not the report the service still holds", async () => {
      // PM-39223 rescans on every load. The component asks the service to show
      // progress immediately (markScanning), so while the rescan runs the tab
      // shows the progress view rather than the report the service still holds
      // from the last scan.
      hasRunScan$.next(true);
      published.next({
        userId,
        status: VaultHealthReportStatus.Success,
        report: new VaultHealthReportView({ totalCount: 10, atRiskCount: 4 }),
      });
      buildNeverSettles();

      await initComponent();
      await settle();

      expect(scanning()).not.toBeNull();
      expect(overview()).toBeNull();
    });
  });

  describe("scan failure retry", () => {
    /** Fails the first scan through the service, leaving the failure view up. */
    async function initFailed() {
      hasRunScan$.next(true);
      publishesErrorOnBuild();

      await initComponent();
      await settle();
    }

    it("starts a new scan on retry", async () => {
      // The first-visit trigger has already completed by the time the failure
      // view is up, so the retry needs its own path into the scan pipeline.
      await initFailed();
      expect(scanError()).not.toBeNull();
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);

      publishesOnBuild(new VaultHealthReportView({ totalCount: 12, atRiskCount: 3 }));
      scanErrorComponent()!.retry.emit();
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(2);
      expect(reportService.buildVaultHealthReport).toHaveBeenLastCalledWith(
        expect.anything(),
        userId,
      );
      expect(scanError()).toBeNull();
      expect(overview()?.report().atRiskCount).toBe(3);
    });
  });

  describe("scan my vault", () => {
    it("marks the Health scan as run when the User clicks the CTA", async () => {
      await initComponent();

      scanButton().click();
      await fixture.whenStable();

      expect(healthAccessService.setHasRunHealthScan).toHaveBeenCalledTimes(1);
      expect(healthAccessService.setHasRunHealthScan).toHaveBeenCalledWith(userId);
    });

    it("does not mark the Health scan as run before the User clicks the CTA", async () => {
      await initComponent();

      expect(healthAccessService.setHasRunHealthScan).not.toHaveBeenCalled();
    });

    it("does not mark the Health scan as run when there is no active account", async () => {
      activeAccount$.next(null);
      await initComponent();

      scanButton().click();
      await fixture.whenStable();

      expect(healthAccessService.setHasRunHealthScan).not.toHaveBeenCalled();
    });
  });

  describe("health tab opened state", () => {
    it("marks the Health report as opened the first time the User views it", async () => {
      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).toHaveBeenCalledWith(userId);
    });

    it("does not mark the Health report as opened when the User has already viewed it", async () => {
      hasBeenOpened$.next(true);

      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).not.toHaveBeenCalled();
    });

    it("does not mark the Health report as opened when there is no active account", async () => {
      activeAccount$.next(null);

      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).not.toHaveBeenCalled();
    });

    it("does not read User state when there is no active account", async () => {
      activeAccount$.next(null);

      await initComponent();

      expect(healthAccessService.healthHasBeenOpened$).not.toHaveBeenCalled();
      expect(healthAccessService.hasRunHealthScan$).not.toHaveBeenCalled();
    });
  });

  describe("premium gating", () => {
    /** Runs a scan to success so the Health Overview is mounted. */
    async function initWithReport() {
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

      await initComponent();
      await settle();
    }

    it("locks the Health Overview for a user without premium", async () => {
      hasPremium$.next(false);

      await initWithReport();

      expect(overview()?.locked()).toBe(true);
    });

    it("leaves the Health Overview unlocked for a user with premium", async () => {
      hasPremium$.next(true);

      await initWithReport();

      expect(overview()?.locked()).toBe(false);
    });

    it("unlocks the Health Overview when the user upgrades, with no reload", async () => {
      hasPremium$.next(false);
      await initWithReport();
      expect(overview()?.locked()).toBe(true);

      // The subscription check reads hasPremiumFromAnySource$, so the view swaps
      // itself once the upgrade lands rather than needing the tab reopened.
      hasPremium$.next(true);
      await settle();

      expect(overview()?.locked()).toBe(false);
    });

    it("stays locked when the premium check has not yet emitted", async () => {
      // A free user must never see navigable categories while the check settles.
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
        new Subject<boolean>(),
      );

      await initWithReport();

      expect(overview()?.locked()).toBe(true);
    });

    it("scopes the premium check to the active user", async () => {
      await initWithReport();

      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
        userId,
      );
    });

    it("launches the upgrade flow when the Health Overview asks for it", async () => {
      hasPremium$.next(false);
      await initWithReport();

      overview()!.upgrade.emit();
      await settle();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });

    it("does not launch the upgrade flow on its own", async () => {
      hasPremium$.next(false);

      await initWithReport();

      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });
});
