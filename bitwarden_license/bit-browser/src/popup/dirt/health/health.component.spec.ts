import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, map, of, ReplaySubject, Subject } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
class MockHealthScanErrorComponent {}

describe("HealthComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthComponent>;
  let activeAccount$: ReplaySubject<Account | null>;
  let hasBeenOpened$: BehaviorSubject<boolean>;
  let hasRunScan$: BehaviorSubject<boolean>;
  let healthAccessService: MockProxy<HealthAccessService>;
  let cipherService: MockProxy<CipherService>;
  let reportService: MockProxy<VaultHealthReportService>;
  let logService: MockProxy<LogService>;
  /**
   * Stands in for the service's published report. Scoped by user, exactly as
   * DefaultVaultHealthReportService is, so a report published for one account is
   * invisible to the next.
   */
  let published: BehaviorSubject<{ userId: UserId; report: VaultHealthReportView } | null>;

  /**
   * Makes a build publish `report` and then resolve, which is the contract the
   * root depends on: the report is readable by the time the promise settles.
   */
  function publishesOnBuild(report: VaultHealthReportView) {
    reportService.buildVaultHealthReport.mockImplementation(async (_ciphers, id) => {
      published.next({ userId: id, report });
    });
  }

  /** A report the service already holds, as if from an earlier scan this session. */
  function alreadyPublished(report: VaultHealthReportView, id: UserId = userId) {
    published.next({ userId: id, report });
  }

  /** Leaves a build in flight forever, so the scan never completes. */
  function buildNeverSettles() {
    reportService.buildVaultHealthReport.mockReturnValue(new Promise<void>(() => {}));
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

  /** Settles the scan pipeline and re-renders. */
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    hasBeenOpened$ = new BehaviorSubject<boolean>(false);
    hasRunScan$ = new BehaviorSubject<boolean>(false);

    healthAccessService = mock<HealthAccessService>();
    healthAccessService.healthHasBeenOpened$.mockReturnValue(hasBeenOpened$);
    healthAccessService.hasRunHealthScan$.mockReturnValue(hasRunScan$);

    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(of([] as CipherView[]));

    reportService = mock<VaultHealthReportService>();
    // Mirror the real service: buildVaultHealthReport publishes the report and
    // resolves void, and getVaultHealthReport$ replays whatever was published.
    // The publish happens before the promise resolves, exactly as the
    // implementation does it, so a read after the build sees the fresh report.
    published = new BehaviorSubject<{ userId: UserId; report: VaultHealthReportView } | null>(null);
    reportService.getVaultHealthReport$.mockImplementation((id) =>
      published.pipe(map((scoped) => (scoped?.userId === id ? scoped.report : null))),
    );
    publishesOnBuild(new VaultHealthReportView());

    logService = mock<LogService>();

    await TestBed.configureTestingModule({
      imports: [HealthComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: HealthAccessService, useValue: healthAccessService },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: LogService, useValue: logService },
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

    it("shows the overview immediately when a report is already published", async () => {
      // Returning from a category detail re-creates this component and restarts
      // the scan. The user must not be sent back to the progress view for
      // results they were just looking at, so a report the service already holds
      // wins over an in-flight scan.
      hasRunScan$.next(true);
      alreadyPublished(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));
      buildNeverSettles();

      await initComponent();
      await settle();

      expect(overview()).not.toBeNull();
      expect(overview()?.report().atRiskCount).toBe(10);
      expect(scanning()).toBeNull();
    });

    it("keeps the published report on screen when a background refresh fails", async () => {
      // Losing results the user can see, because a silent re-scan failed, is
      // worse than showing slightly stale ones. The failure view is for having
      // nothing to show at all.
      hasRunScan$.next(true);
      alreadyPublished(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));
      reportService.buildVaultHealthReport.mockRejectedValue(new Error("HIBP unavailable"));

      await initComponent();
      await settle();

      expect(overview()?.report().atRiskCount).toBe(10);
      expect(scanError()).toBeNull();
    });

    it("renders the report the service published, not a locally held copy", async () => {
      // The scan has to publish through the service, because /health/:category
      // is a sibling route rather than a child: this component is destroyed on
      // navigation, and HealthRiskCategoryDetailComponent reads the report from
      // getVaultHealthReport$ alone, bouncing back here when it is null. Keeping
      // the result only in this component's own state would compile and quietly
      // break every category row, so pin the read path.
      hasRunScan$.next(true);
      publishesOnBuild(new VaultHealthReportView({ totalCount: 40, atRiskCount: 7 }));

      await initComponent();
      await settle();

      expect(reportService.getVaultHealthReport$).toHaveBeenCalledWith(userId);
      expect(overview()?.report().atRiskCount).toBe(7);
    });

    it("shows the scan failure view when the scan fails", async () => {
      hasRunScan$.next(true);
      reportService.buildVaultHealthReport.mockRejectedValue(new Error("HIBP unavailable"));

      await initComponent();
      await settle();

      expect(scanError()).not.toBeNull();
      expect(overview()).toBeNull();
      expect(scanning()).toBeNull();
    });

    it("logs the error when the scan fails", async () => {
      hasRunScan$.next(true);
      reportService.buildVaultHealthReport.mockRejectedValue(new Error("HIBP unavailable"));

      await initComponent();
      await settle();

      expect(logService.error).toHaveBeenCalledWith("Vault health scan failed", expect.anything());
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

    it("scans once and does not rescan when the vault changes", async () => {
      hasRunScan$.next(true);
      const ciphers$ = new BehaviorSubject<CipherView[]>([]);
      cipherService.cipherViews$.mockReturnValue(ciphers$);

      await initComponent();
      await settle();
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);

      // A vault edit must not re-run the breach lookup.
      ciphers$.next([{} as CipherView]);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
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
});
