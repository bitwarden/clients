import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject, Subject, throwError } from "rxjs";

import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ScanFailureComponent } from "./scan-failure/scan-failure.component";
import { ScanProgressComponent } from "./scan-progress/scan-progress.component";
import { VaultHealthComponent } from "./vault-health.component";

@Component({
  selector: "dirt-scan-progress",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockScanProgressComponent {}

@Component({
  selector: "dirt-scan-failure",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockScanFailureComponent {}

describe("VaultHealthComponent", () => {
  const userId = Utils.newGuid() as UserId;
  const ciphers = [{ id: "cipher-1" } as CipherView];

  let fixture: ComponentFixture<VaultHealthComponent>;
  let component: VaultHealthComponent;

  let activeAccount$: ReplaySubject<Account | null>;
  let cipherViews$: BehaviorSubject<CipherView[]>;
  let report$: Subject<VaultHealthReportView>;

  let cipherService: MockProxy<CipherService>;
  let vaultHealthReportService: MockProxy<VaultHealthReportService>;
  let logService: MockProxy<LogService>;

  /** Creates the component, which starts a scan in ngOnInit. */
  async function initComponent() {
    fixture = TestBed.createComponent(VaultHealthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Completes the in-flight scan successfully. */
  async function completeScan(report = new VaultHealthReportView({ totalCount: 1 })) {
    report$.next(report);
    report$.complete();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function queryProgress() {
    return fixture.nativeElement.querySelector("dirt-scan-progress");
  }

  function queryFailure() {
    return fixture.nativeElement.querySelector("dirt-scan-failure");
  }

  function queryResults() {
    return fixture.nativeElement.querySelector('[data-testid="scan-results"]');
  }

  beforeEach(async () => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    cipherViews$ = new BehaviorSubject<CipherView[]>(ciphers);
    report$ = new Subject<VaultHealthReportView>();

    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(cipherViews$);

    vaultHealthReportService = mock<VaultHealthReportService>();
    vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(report$);

    logService = mock<LogService>();

    await TestBed.configureTestingModule({
      imports: [VaultHealthComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: vaultHealthReportService },
        { provide: LogService, useValue: logService },
      ],
    })
      .overrideComponent(VaultHealthComponent, {
        remove: { imports: [ScanProgressComponent, ScanFailureComponent] },
        add: { imports: [MockScanProgressComponent, MockScanFailureComponent] },
      })
      .compileComponents();
  });

  describe("a later visit scans automatically", () => {
    it("runs the scan on open with no additional prompt", async () => {
      await initComponent();

      expect(vaultHealthReportService.buildVaultHealthReport$).toHaveBeenCalledTimes(1);
      expect(vaultHealthReportService.buildVaultHealthReport$).toHaveBeenCalledWith(
        ciphers,
        userId,
      );
    });

    it("shows the Scan Progress view while the scan runs", async () => {
      await initComponent();

      expect(queryProgress()).not.toBeNull();
      expect(queryResults()).toBeNull();
      expect(queryFailure()).toBeNull();
    });

    it("takes the user to the Health Overview on success", async () => {
      await initComponent();

      await completeScan();

      expect(queryResults()).not.toBeNull();
      expect(queryProgress()).toBeNull();
      expect(queryFailure()).toBeNull();
    });

    it("scans only the active user's vault", async () => {
      await initComponent();

      expect(cipherService.cipherViews$).toHaveBeenCalledWith(userId);
    });

    it("offers no manual rescan control", async () => {
      await initComponent();
      await completeScan();

      expect(fixture.nativeElement.querySelector("button")).toBeNull();
    });
  });

  describe("a user who left the intro without scanning scans on return", () => {
    it("runs the scan automatically when the tab is reopened", async () => {
      // Returning to the Health tab re-creates the component, so a fresh
      // instance must scan on its own without any user action.
      await initComponent();
      await completeScan();

      report$ = new Subject<VaultHealthReportView>();
      vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(report$);

      await initComponent();

      expect(vaultHealthReportService.buildVaultHealthReport$).toHaveBeenCalledTimes(2);
      expect(queryProgress()).not.toBeNull();
    });
  });

  describe("the user scans from the intro on the first visit", () => {
    it("shows the Scan Progress view when startScan is called", async () => {
      await initComponent();
      await completeScan();
      expect(queryResults()).not.toBeNull();

      report$ = new Subject<VaultHealthReportView>();
      vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(report$);

      component.startScan();
      fixture.detectChanges();

      expect(queryProgress()).not.toBeNull();
      expect(queryResults()).toBeNull();
    });

    it("takes the user to the Health Overview when that scan succeeds", async () => {
      await initComponent();
      await completeScan();

      report$ = new Subject<VaultHealthReportView>();
      vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(report$);

      component.startScan();
      await completeScan(new VaultHealthReportView({ totalCount: 2, atRiskCount: 1 }));

      expect(queryResults()).not.toBeNull();
      expect(queryProgress()).toBeNull();
    });
  });

  describe("the scan fails", () => {
    beforeEach(() => {
      vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(
        throwError(() => new Error("HIBP unavailable")),
      );
    });

    it("shows the scan-failure state instead of the Health Overview", async () => {
      await initComponent();

      expect(queryFailure()).not.toBeNull();
      expect(queryResults()).toBeNull();
      expect(queryProgress()).toBeNull();
    });

    it("logs the failure without the error payload", async () => {
      await initComponent();

      expect(logService.error).toHaveBeenCalledWith("Vault health scan failed.");
      expect(logService.error).toHaveBeenCalledTimes(1);
    });

    it("can still scan again after a failure", async () => {
      await initComponent();
      expect(queryFailure()).not.toBeNull();

      report$ = new Subject<VaultHealthReportView>();
      vaultHealthReportService.buildVaultHealthReport$.mockReturnValue(report$);

      component.startScan();
      await completeScan();

      expect(queryResults()).not.toBeNull();
      expect(queryFailure()).toBeNull();
    });
  });

  describe("when no account is active yet", () => {
    it("does not scan until an active account is available", async () => {
      activeAccount$ = new ReplaySubject<Account | null>(1);
      activeAccount$.next(null);

      await TestBed.overrideProvider(AccountService, {
        useValue: { activeAccount$ },
      }).compileComponents();

      await initComponent();

      expect(vaultHealthReportService.buildVaultHealthReport$).not.toHaveBeenCalled();
      expect(queryProgress()).not.toBeNull();

      activeAccount$.next({ id: userId } as Account);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(vaultHealthReportService.buildVaultHealthReport$).toHaveBeenCalledWith(
        ciphers,
        userId,
      );
    });
  });
});
