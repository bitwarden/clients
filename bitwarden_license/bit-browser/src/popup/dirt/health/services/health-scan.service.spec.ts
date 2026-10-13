import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject, Subscription } from "rxjs";

import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
  VaultHealthReportStatus,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { newGuid } from "@bitwarden/guid";

import { HealthScanService } from "./health-scan.service";

describe("HealthScanService", () => {
  const userId = newGuid() as UserId;
  const otherUserId = newGuid() as UserId;

  /** Longer than the service's internal debounce, so one tick flushes a burst. */
  const PAST_DEBOUNCE_MS = 500;

  let cipherService: MockProxy<CipherService>;
  let reportService: MockProxy<VaultHealthReportService>;
  let logService: MockProxy<LogService>;
  let service: HealthScanService;

  let ciphers$: BehaviorSubject<CipherView[] | null>;
  let reportState$: BehaviorSubject<VaultHealthReportState>;

  /** Tears down whatever a test subscribed, mirroring a Health view being destroyed. */
  let subscriptions: Subscription[];

  /**
   * Memoized by id so the same login is the same instance everywhere in a test.
   * `new CipherView()` stamps `revisionDate` with the current time, so rebuilding
   * one would make `toHaveBeenCalledWith` depend on the clock.
   */
  let ciphersById: Map<string, CipherView>;

  const cipher = (id: string): CipherView => {
    let view = ciphersById.get(id);
    if (view == null) {
      view = new CipherView();
      view.id = id;
      ciphersById.set(id, view);
    }
    return view;
  };

  /** Subscribes like a Health view would and returns the handle so it can be destroyed. */
  const watch = (source$: ReturnType<HealthScanService["keepReportCurrent$"]>): Subscription => {
    const subscription = source$.subscribe();
    subscriptions.push(subscription);
    return subscription;
  };

  /**
   * Lets every queued promise settle and the debounce elapse. Microtasks are
   * flushed first: the vault watch only subscribes once the scan's promise has
   * resolved, so advancing the clock before that would start no debounce at all.
   */
  const settle = async () => {
    const flush = async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    };

    await flush();
    jest.advanceTimersByTime(PAST_DEBOUNCE_MS);
    await flush();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    cipherService = mock<CipherService>();
    reportService = mock<VaultHealthReportService>();
    logService = mock<LogService>();
    subscriptions = [];
    ciphersById = new Map();

    ciphers$ = new BehaviorSubject<CipherView[] | null>([cipher("a")]);
    reportState$ = new BehaviorSubject<VaultHealthReportState>(VAULT_HEALTH_REPORT_IDLE);

    cipherService.cipherViews$.mockReturnValue(ciphers$ as never);
    reportService.getVaultHealthReport$.mockReturnValue(reportState$);
    reportService.buildVaultHealthReport.mockResolvedValue(undefined);
    // Auto-mocked methods return undefined, which breaks concatMap.
    reportService.refreshVaultHealthReport.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(HealthScanService);
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("keepReportCurrent$", () => {
    it("does nothing until something subscribes", async () => {
      service.keepReportCurrent$(userId);
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    });

    it("scans when there is no report yet, using the ciphers from the stream", async () => {
      watch(service.keepReportCurrent$(userId));
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledWith([cipher("a")], userId);
    });

    it("does not scan when a report is already published", async () => {
      // Both Health views call this, so navigating between them must not repeat
      // the breach lookups the first one already spent.
      reportState$.next({ status: VaultHealthReportStatus.Success, report: {} as never });

      watch(service.keepReportCurrent$(userId));
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    });

    it("does not scan while a scan is already running", async () => {
      reportState$.next({ status: VaultHealthReportStatus.Loading, report: null });

      watch(service.keepReportCurrent$(userId));
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    });

    it("still watches the vault when it skipped the scan", async () => {
      reportState$.next({ status: VaultHealthReportStatus.Success, report: {} as never });
      watch(service.keepReportCurrent$(userId));
      await settle();

      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith(
        [cipher("a"), cipher("b")],
        userId,
      );
    });

    it("does not scan the replayed null from cipherViews$", async () => {
      // cipherViews$ emits null while decryption is still running. Scanning that
      // would report a permanently healthy vault.
      ciphers$.next(null);

      watch(service.keepReportCurrent$(userId));
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();

      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(reportService.buildVaultHealthReport).toHaveBeenCalledWith(
        [cipher("a"), cipher("b")],
        userId,
      );
    });
  });

  describe("watching the vault", () => {
    it("refreshes when the vault changes, without a second full scan", async () => {
      watch(service.keepReportCurrent$(userId));
      await settle();
      reportService.buildVaultHealthReport.mockClear();

      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith(
        [cipher("a"), cipher("b")],
        userId,
      );
      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    });

    it("does not start watching until the full scan has resolved", async () => {
      // Otherwise a change landing mid-scan has no baseline to compare against, is
      // treated as handled, and is then lost: cipherViews$ will not re-emit.
      let releaseScan!: () => void;
      reportService.buildVaultHealthReport.mockReturnValue(
        new Promise<void>((resolve) => (releaseScan = resolve)),
      );

      watch(service.keepReportCurrent$(userId));
      await settle();
      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();

      expect(reportService.refreshVaultHealthReport).not.toHaveBeenCalled();

      releaseScan();
      await settle();

      // The change is not lost: the watch reads the current value on subscribe.
      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith(
        [cipher("a"), cipher("b")],
        userId,
      );
    });

    it("refreshes once when the watch starts, from the value the scan already used", async () => {
      // Unavoidable: cipherViews$ replays its current value the moment the watch
      // subscribes. Harmless because the vault has not changed, so
      // refreshVaultHealthReport compares fingerprints and returns without
      // publishing or spending a breach lookup.
      watch(service.keepReportCurrent$(userId));
      await settle();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledTimes(1);
      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith([cipher("a")], userId);
    });

    it("collapses a burst of vault changes into one refresh", async () => {
      watch(service.keepReportCurrent$(userId));
      await settle();
      // Drop the startup refresh so this counts only what the burst caused.
      reportService.refreshVaultHealthReport.mockClear();

      ciphers$.next([cipher("a"), cipher("b")]);
      ciphers$.next([cipher("a"), cipher("b"), cipher("c")]);
      ciphers$.next([cipher("a"), cipher("b"), cipher("c"), cipher("d")]);
      await settle();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledTimes(1);
      // The latest state wins, not the first of the burst.
      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledWith(
        [cipher("a"), cipher("b"), cipher("c"), cipher("d")],
        userId,
      );
    });

    it("does not overlap refreshes", async () => {
      // A superseded promise still resolves and could publish a stale report late.
      watch(service.keepReportCurrent$(userId));
      await settle();
      reportService.refreshVaultHealthReport.mockClear();

      let releaseFirst!: () => void;
      reportService.refreshVaultHealthReport.mockReturnValueOnce(
        new Promise<void>((resolve) => (releaseFirst = resolve)),
      );

      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();
      ciphers$.next([cipher("a"), cipher("b"), cipher("c")]);
      await settle();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledTimes(1);

      releaseFirst();
      await settle();

      expect(reportService.refreshVaultHealthReport).toHaveBeenCalledTimes(2);
    });

    it("stops watching once the last subscriber goes away", async () => {
      const subscription = watch(service.keepReportCurrent$(userId));
      await settle();
      reportService.refreshVaultHealthReport.mockClear();

      subscription.unsubscribe();
      ciphers$.next([cipher("a"), cipher("b")]);
      await settle();

      expect(reportService.refreshVaultHealthReport).not.toHaveBeenCalled();
    });
  });

  describe("retryScan", () => {
    it("runs another full scan", async () => {
      watch(service.keepReportCurrent$(userId));
      await settle();
      reportService.buildVaultHealthReport.mockClear();

      service.retryScan(userId);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });

    it("scans even when the initial one was skipped", async () => {
      // The failure view is reachable on the detail page, so its retry has to work
      // on a view that reused an existing report rather than scanning.
      reportState$.next({ status: VaultHealthReportStatus.Success, report: {} as never });
      watch(service.keepReportCurrent$(userId));
      await settle();

      service.retryScan(userId);
      await settle();

      expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    });

    it("does not scan for an account that is not subscribed", async () => {
      watch(service.keepReportCurrent$(userId));
      await settle();
      reportService.buildVaultHealthReport.mockClear();

      service.retryScan(otherUserId);
      await settle();

      expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    });
  });

  describe("pipelineFailed$", () => {
    const failingCiphers = () => {
      const failing$ = new Subject<CipherView[] | null>();
      cipherService.cipherViews$.mockReturnValue(failing$ as never);
      return failing$;
    };

    it("starts false", async () => {
      await expect(firstValueFrom(service.pipelineFailed$(userId))).resolves.toBe(false);
    });

    it("records and logs a failure to fetch the ciphers to scan", async () => {
      const failing$ = failingCiphers();
      watch(service.keepReportCurrent$(userId));
      const failure = new Error("decryption unavailable");

      failing$.error(failure);
      await settle();

      await expect(firstValueFrom(service.pipelineFailed$(userId))).resolves.toBe(true);
      expect(logService.error).toHaveBeenCalledWith("Vault health scan pipeline failed", failure);
    });

    it("clears at the start of the next scan", async () => {
      const failing$ = failingCiphers();
      watch(service.keepReportCurrent$(userId));
      failing$.error(new Error("decryption unavailable"));
      await settle();

      cipherService.cipherViews$.mockReturnValue(ciphers$ as never);
      service.retryScan(userId);
      await settle();

      await expect(firstValueFrom(service.pipelineFailed$(userId))).resolves.toBe(false);
    });

    it("does not leak a failure to another account", async () => {
      const failing$ = failingCiphers();
      watch(service.keepReportCurrent$(userId));
      failing$.error(new Error("decryption unavailable"));
      await settle();

      await expect(firstValueFrom(service.pipelineFailed$(otherUserId))).resolves.toBe(false);
    });

    it("stays false when the vault watch fails, so an on-screen report is kept", async () => {
      // A background failure must not put a failure view over results the user is
      // already reading.
      const failing$ = new BehaviorSubject<CipherView[] | null>([cipher("a")]);
      cipherService.cipherViews$.mockReturnValue(failing$ as never);
      watch(service.keepReportCurrent$(userId));
      await settle();
      const failure = new Error("decryption cleared");

      failing$.error(failure);
      await settle();

      await expect(firstValueFrom(service.pipelineFailed$(userId))).resolves.toBe(false);
      expect(logService.error).toHaveBeenCalledWith(
        "Vault health refresh pipeline failed",
        failure,
      );
    });
  });
});
