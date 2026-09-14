import { mock } from "jest-mock-extended";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import type { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportState,
} from "../../models/vault-health-report-state";
import { VaultHealthReportStatus } from "../../models/vault-health-report-status";
import { VaultHealthReportView } from "../../models/view/vault-health-report.view";

import { DefaultVaultHealthReportService } from "./default-vault-health-report.service";

describe("DefaultVaultHealthReportService", () => {
  const userId = "test-user-id" as UserId;

  let cipherRiskService: ReturnType<typeof mock<CipherRiskService>>;
  let logService: ReturnType<typeof mock<LogService>>;
  let service: DefaultVaultHealthReportService;

  // Per-test lookup so risk results are returned for exactly the ciphers passed,
  // keyed by id (mirrors the SDK, which stamps each result with its cipher id).
  let riskById: Map<string, CipherRiskResult>;

  /** Tears down the long-lived subscriptions the emission tests set up. */
  let destroy$: Subject<void>;

  beforeEach(() => {
    cipherRiskService = mock<CipherRiskService>();
    logService = mock<LogService>();
    riskById = new Map();
    destroy$ = new Subject<void>();

    cipherRiskService.buildPasswordReuseMap.mockResolvedValue({});
    cipherRiskService.computeRiskForCiphers.mockImplementation(async (ciphers) =>
      ciphers.map((c) => riskById.get(c.id)!),
    );

    service = new DefaultVaultHealthReportService(cipherRiskService, logService);
  });

  afterEach(() => {
    destroy$.next();
    destroy$.complete();
    jest.clearAllMocks();
  });

  // --- helpers -------------------------------------------------------------

  /**
   * Fixed so a login rebuilt with the same arguments fingerprints identically.
   * `new CipherView()` stamps `revisionDate` with the current time, which would
   * make "has the vault changed" comparisons depend on the clock.
   */
  const BASE_REVISION = "2026-01-01T00:00:00.000Z";

  const login = (
    id: string,
    opts: {
      password?: string;
      organizationId?: string | null;
      deleted?: boolean;
      type?: CipherType;
      /** Bump to model the login having been saved. */
      revision?: string;
      /** Client-only usage data, written by autofill and by launching a URI. */
      lastUsedDate?: number;
    } = {},
  ): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.type = opts.type ?? CipherType.Login;
    cipher.organizationId = (opts.organizationId ?? null) as CipherView["organizationId"];
    cipher.deletedDate = opts.deleted ? new Date() : (null as unknown as Date);
    cipher.revisionDate = new Date(opts.revision ?? BASE_REVISION);
    if (opts.lastUsedDate != null) {
      cipher.localData = { lastUsedDate: opts.lastUsedDate };
    }
    cipher.login = new LoginView();
    cipher.login.password = opts.password ?? `pw-${id}`;
    return cipher;
  };

  /** A login saved since the last scan, so the vault fingerprint has moved. */
  const editedLogin = (id: string, opts: Parameters<typeof login>[1] = {}): CipherView =>
    login(id, { ...opts, revision: "2026-06-01T00:00:00.000Z" });

  const risk = (
    id: string,
    opts: { strength?: number; exposed?: number; reuse?: number; exposedError?: string } = {},
  ): CipherRiskResult => {
    const exposed = opts.exposed ?? 0;
    const exposedResult =
      opts.exposedError != null
        ? { type: "Error", value: opts.exposedError }
        : exposed > 0
          ? { type: "Found", value: exposed }
          : { type: "NotChecked" };
    return {
      id,
      password_strength: opts.strength ?? 4,
      exposed_result: exposedResult,
      reuse_count: opts.reuse ?? 1,
    } as unknown as CipherRiskResult;
  };

  /** Register a risk result per cipher id and return the cipher list to pass in. */
  const withRisks = (entries: { cipher: CipherView; risk: CipherRiskResult }[]): CipherView[] => {
    entries.forEach((e) => riskById.set(e.cipher.id, e.risk));
    return entries.map((e) => e.cipher);
  };

  /** Runs a scan and reads the report the service published for it. */
  const report = async (ciphers: CipherView[]): Promise<VaultHealthReportView> => {
    await service.buildVaultHealthReport(ciphers, userId);
    return (await firstValueFrom(service.getVaultHealthReport$(userId))).report!;
  };

  /** The report currently published for a user, or null. */
  const currentReport = async (id: UserId = userId): Promise<VaultHealthReportView | null> =>
    (await firstValueFrom(service.getVaultHealthReport$(id))).report;

  /** The cipher ids bucketed into a category, in order. */
  const cipherIds = (items: CipherHealthView[]): string[] => items.map((item) => item.cipherId);

  // --- tests ---------------------------------------------------------------

  it("categorizes each single-risk login into its matching category", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
      { cipher: login("b"), risk: risk("b", { strength: 1 }) },
      { cipher: login("c"), risk: risk("c", { reuse: 2 }) },
    ]);

    const result = await report(ciphers);

    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["b"]);
    expect(cipherIds(result.categoryItems.reused)).toEqual(["c"]);
  });

  it("counts an exposed+weak+reused login once, under Exposed (highest-risk-wins)", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a", { strength: 1, exposed: 5, reuse: 3 }) },
    ]);

    const result = await report(ciphers);

    expect(result.atRiskCount).toBe(1);
    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
    // The bucketed item still carries every category it is at risk in, so the
    // cross-category view is available without a separate flat list.
    const [bucketed] = result.categoryItems.exposed;
    expect(bucketed.hasExposedPassword).toBe(true);
    expect(bucketed.hasWeakPassword).toBe(true);
    expect(bucketed.hasReusedPassword).toBe(true);
  });

  it("places a weak+reused (not exposed) login under Weak", async () => {
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { strength: 2, reuse: 4 }) }]);

    const result = await report(ciphers);

    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["a"]);
    expect(result.categoryItems.reused).toHaveLength(0);
    const [bucketed] = result.categoryItems.weak;
    expect(bucketed.hasWeakPassword).toBe(true);
    expect(bucketed.hasReusedPassword).toBe(true);
  });

  it("scores unique at-risk logins over total logins", async () => {
    const ciphers = withRisks(
      Array.from({ length: 10 }, (_, i) => ({
        cipher: login(`c${i}`),
        risk: i < 3 ? risk(`c${i}`, { strength: 1 }) : risk(`c${i}`),
      })),
    );

    const result = await report(ciphers);

    expect(result.totalCount).toBe(10);
    expect(result.atRiskCount).toBe(3);
    expect(result.score).toBeCloseTo(0.3);
  });

  it("returns an empty report with score 0 when there are no scoped logins", async () => {
    const result = await report([]);

    expect(result.totalCount).toBe(0);
    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
    expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
  });

  it("reports zero at risk when all logins are healthy", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a") },
      { cipher: login("b"), risk: risk("b") },
      { cipher: login("c"), risk: risk("c") },
    ]);

    const result = await report(ciphers);

    expect(result.totalCount).toBe(3);
    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
  });

  it("excludes org items, deleted items, non-logins, and passwordless logins from scope", async () => {
    const personal = login("personal");
    riskById.set(personal.id, risk("personal", { strength: 1 }));
    const ciphers = [
      personal,
      login("org", { organizationId: "org-1" }),
      login("deleted", { deleted: true }),
      login("card", { type: CipherType.Card }),
      login("nopass", { password: "" }),
    ];

    const result = await report(ciphers);

    expect(result.totalCount).toBe(1);
    const passed = cipherRiskService.computeRiskForCiphers.mock.calls[0][0];
    expect(passed.map((c) => c.id)).toEqual(["personal"]);
  });

  it("publishes an error state instead of rejecting when the risk computation fails", async () => {
    // Failures come back as an error status, not a thrown error, so callers
    // route to the failure view without each needing a catch.
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a") }]);
    cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(new Error("HIBP unavailable"));

    await expect(service.buildVaultHealthReport(ciphers, userId)).resolves.toBeUndefined();

    await expect(firstValueFrom(service.getVaultHealthReport$(userId))).resolves.toMatchObject({
      status: VaultHealthReportStatus.Error,
    });
  });

  it("logs the failure so a failed report is identifiable in a log dump", async () => {
    // Asked for in review: the failure is logged where it happens, so it is
    // captured for every caller rather than only the Health tab.
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a") }]);
    const failure = new Error("HIBP unavailable");
    cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(failure);

    await service.buildVaultHealthReport(ciphers, userId);

    expect(logService.error).toHaveBeenCalledWith("Vault health report generation failed", failure);
  });

  it("keeps the previous report readable when a rescan fails", async () => {
    // A failed rescan keeps the last report so a category page reading it isn't
    // ejected.
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
    await service.buildVaultHealthReport(ciphers, userId);
    cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(new Error("HIBP unavailable"));

    await service.buildVaultHealthReport(ciphers, userId);

    await expect(firstValueFrom(service.getVaultHealthReport$(userId))).resolves.toMatchObject({
      status: VaultHealthReportStatus.Error,
    });
    const retained = await currentReport();
    expect(cipherIds(retained!.categoryItems.exposed)).toEqual(["a"]);
  });

  it("does not blink the report to null while a rescan is in flight", async () => {
    // The report stays put through a rescan; only its status changes. The detail
    // view reads the report and must never see it go null.
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
    await service.buildVaultHealthReport(ciphers, userId);
    const reports: (VaultHealthReportView | null)[] = [];
    service
      .getVaultHealthReport$(userId)
      .pipe(takeUntil(destroy$))
      .subscribe((state) => reports.push(state.report));

    await service.buildVaultHealthReport(ciphers, userId);

    // The report is present the whole way through, same login before and after.
    expect(reports.every((report) => report != null)).toBe(true);
    expect(cipherIds(reports[0]!.categoryItems.exposed)).toEqual(["a"]);
    expect(cipherIds(reports[reports.length - 1]!.categoryItems.exposed)).toEqual(["a"]);
  });

  it("enables the exposed check and passes the pre-built reuse map", async () => {
    const reuseMap = { "pw-a": 1 };
    cipherRiskService.buildPasswordReuseMap.mockResolvedValue(reuseMap);
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a") }]);

    await report(ciphers);

    expect(cipherRiskService.computeRiskForCiphers).toHaveBeenCalledWith(
      expect.any(Array),
      userId,
      {
        passwordMap: reuseMap,
        checkExposed: true,
      },
    );
  });

  it("maps each result to its cipher by id, not by array position", async () => {
    const a = login("a");
    const b = login("b");
    const c = login("c");
    riskById.set("a", risk("a", { exposed: 4 }));
    riskById.set("b", risk("b", { strength: 1 }));
    riskById.set("c", risk("c", { reuse: 2 }));
    // Return results in a different order than the inputs.
    cipherRiskService.computeRiskForCiphers.mockResolvedValueOnce([
      riskById.get("c")!,
      riskById.get("a")!,
      riskById.get("b")!,
    ]);

    const result = await report([a, b, c]);

    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["b"]);
    expect(cipherIds(result.categoryItems.reused)).toEqual(["c"]);
  });

  describe("a failed exposed-password check", () => {
    it("publishes an error state when every login's exposed check failed", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposedError: "network error" }) },
        { cipher: login("b"), risk: risk("b", { exposedError: "network error" }) },
      ]);

      await service.buildVaultHealthReport(ciphers, userId);

      const state = await firstValueFrom(service.getVaultHealthReport$(userId));
      expect(state.status).toBe(VaultHealthReportStatus.Error);
    });

    it("publishes an error state when only one login's exposed check failed", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposed: 5 }) },
        { cipher: login("b"), risk: risk("b", { exposedError: "429 Too Many Requests" }) },
        { cipher: login("c"), risk: risk("c") },
      ]);

      await service.buildVaultHealthReport(ciphers, userId);

      const state = await firstValueFrom(service.getVaultHealthReport$(userId));
      expect(state.status).toBe(VaultHealthReportStatus.Error);
    });

    it("does not publish a report that under-counts the exposed category", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposedError: "network error" }) },
      ]);

      await service.buildVaultHealthReport(ciphers, userId);

      expect(await currentReport()).toBeNull();
    });

    it("logs how many logins could not be checked", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposedError: "network error" }) },
        { cipher: login("b"), risk: risk("b", { exposedError: "network error" }) },
      ]);

      await service.buildVaultHealthReport(ciphers, userId);

      expect(logService.error).toHaveBeenCalledWith(
        "Vault health report generation failed",
        expect.objectContaining({ message: expect.stringContaining("2 of 2") }),
      );
    });

    it("still scores an unchecked login as healthy, so a scan without breach data does not fail", async () => {
      const built = await report(withRisks([{ cipher: login("a"), risk: risk("a") }]));

      expect(built.atRiskCount).toBe(0);
      expect(built.categoryItems.exposed).toEqual([]);
    });

    it("keeps the previous report readable when a rescan's exposed check fails", async () => {
      const healthy = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 5 }) }]);
      await service.buildVaultHealthReport(healthy, userId);
      const before = await currentReport();

      const failing = withRisks([
        { cipher: editedLogin("a"), risk: risk("a", { exposedError: "network error" }) },
      ]);
      await service.buildVaultHealthReport(failing, userId);

      expect(await currentReport()).toBe(before);
    });

    it("leaves the report on screen when a background refresh's exposed check fails", async () => {
      const healthy = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 5 }) }]);
      await service.buildVaultHealthReport(healthy, userId);
      const before = await currentReport();

      const failing = withRisks([
        { cipher: editedLogin("a"), risk: risk("a", { exposedError: "network error" }) },
      ]);
      await service.refreshVaultHealthReport(failing, userId);

      const state = await firstValueFrom(service.getVaultHealthReport$(userId));
      expect(state.status).toBe(VaultHealthReportStatus.Success);
      expect(state.report).toBe(before);
    });

    it("does not fail an empty vault, which is never checked against the breach API", async () => {
      const built = await report([]);

      expect(built.totalCount).toBe(0);
      expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
    });
  });

  // --- the published state and report --------------------------------------

  describe("getVaultHealthReport$", () => {
    it("emits idle before any generation has started", async () => {
      // Idle carries a null report so the tab can tell "not scanned yet" from
      // "scanned, nothing at risk".
      await expect(firstValueFrom(service.getVaultHealthReport$(userId))).resolves.toEqual(
        VAULT_HEALTH_REPORT_IDLE,
      );
    });

    it("publishes loading before the report resolves, then success", async () => {
      // The Health tab renders its progress view off loading, so it has to be
      // observable while the build is still in flight rather than only after.
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      const seen: VaultHealthReportState[] = [];
      service
        .getVaultHealthReport$(userId)
        .pipe(takeUntil(destroy$))
        .subscribe((state) => seen.push(state));

      const build = service.buildVaultHealthReport(ciphers, userId);
      expect(seen.map((state) => state.status)).toEqual(["idle", "loading"]);

      await build;

      expect(seen.map((state) => state.status)).toEqual(["idle", "loading", "success"]);
    });

    it("carries the report on the success state", async () => {
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(ciphers, userId);

      const state = await firstValueFrom(service.getVaultHealthReport$(userId));

      expect(state.status).toBe(VaultHealthReportStatus.Success);
      expect(cipherIds(state.report!.categoryItems.exposed)).toEqual(["a"]);
    });

    it("replays the latest report to a subscriber that arrives after the scan", async () => {
      // The Risk Category Detail page subscribes on navigation, long after the
      // overview triggered the scan, and reads this replayed value.
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(ciphers, userId);

      const replayed = await currentReport();

      expect(cipherIds(replayed!.categoryItems.exposed)).toEqual(["a"]);
    });

    it("pushes each rescan to existing subscribers", async () => {
      const emissions: (VaultHealthReportView | null)[] = [];
      service
        .getVaultHealthReport$(userId)
        .pipe(takeUntil(destroy$))
        .subscribe((state) => {
          if (state.status === VaultHealthReportStatus.Success) {
            emissions.push(state.report);
          }
        });

      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { strength: 1 }) }]),
        userId,
      );
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { strength: 1 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );

      expect(emissions[0]!.atRiskCount).toBe(1);
      expect(emissions[1]!.atRiskCount).toBe(2);
    });

    it("does not emit one user's state or report to another", async () => {
      // The service outlives an account switch, so account B must never read
      // account A's report.
      const otherUserId = "other-user-id" as UserId;
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(ciphers, userId);

      await expect(firstValueFrom(service.getVaultHealthReport$(otherUserId))).resolves.toEqual(
        VAULT_HEALTH_REPORT_IDLE,
      );
      await expect(currentReport()).resolves.not.toBeNull();
    });

    it("keeps each user's report independent when another user scans", async () => {
      // Each user has their own stream, so scanning for one leaves the other's
      // report untouched.
      const otherUserId = "other-user-id" as UserId;
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("b"), risk: risk("b", { strength: 1 }) }]),
        otherUserId,
      );

      const mine = await currentReport();
      expect(cipherIds(mine!.categoryItems.exposed)).toEqual(["a"]);
      const other = await currentReport(otherUserId);
      expect(cipherIds(other!.categoryItems.weak)).toEqual(["b"]);
    });

    it("does not let a superseded build overwrite the state of the account that replaced it", async () => {
      // Switching account mid-generation abandons the first build, but a promise
      // cannot be cancelled, so it keeps running. If its late result were
      // published it would reset the new account's state, and since only one
      // build runs per Health tab open, nothing would publish again: the tab
      // would sit on the progress view for good.
      const otherUserId = "other-user-id" as UserId;
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);

      let releaseFirst!: () => void;
      const firstHangs = new Promise<void>((resolve) => (releaseFirst = resolve));
      const computeRisk = cipherRiskService.computeRiskForCiphers.getMockImplementation()!;
      cipherRiskService.computeRiskForCiphers.mockImplementation(async (given, id, options) => {
        if (id === userId) {
          await firstHangs;
        }
        return computeRisk(given, id, options);
      });

      const abandoned = service.buildVaultHealthReport(ciphers, userId);
      await service.buildVaultHealthReport(ciphers, otherUserId);
      releaseFirst();
      await abandoned;

      await expect(firstValueFrom(service.getVaultHealthReport$(otherUserId))).resolves.toEqual(
        expect.objectContaining({ status: VaultHealthReportStatus.Success }),
      );
      await expect(currentReport(otherUserId)).resolves.not.toBeNull();
    });
  });

  describe("refreshVaultHealthReport", () => {
    /** Collects every state emitted from now on, so a missed or extra publish shows. */
    const observeStates = (): VaultHealthReportState[] => {
      const seen: VaultHealthReportState[] = [];
      service
        .getVaultHealthReport$(userId)
        .pipe(takeUntil(destroy$))
        .subscribe((state) => seen.push(state));
      return seen;
    };

    /** The exposed/weak/reused ids of the currently published report. */
    const buckets = async () => {
      const report = await currentReport();
      return {
        exposed: cipherIds(report!.categoryItems.exposed),
        weak: cipherIds(report!.categoryItems.weak),
        reused: cipherIds(report!.categoryItems.reused),
      };
    };

    it("does nothing before a scan has published a report", async () => {
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { strength: 1 }) }]);

      await service.refreshVaultHealthReport(ciphers, userId);

      await expect(firstValueFrom(service.getVaultHealthReport$(userId))).resolves.toEqual(
        VAULT_HEALTH_REPORT_IDLE,
      );
      expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
    });

    it("publishes nothing when the vault is unchanged", async () => {
      // The vault watch replays its current value the moment it subscribes, right
      // after the scan that already consumed it. That must not cost a rebuild.
      const scanned = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(scanned, userId);
      const seen = observeStates();
      cipherRiskService.computeRiskForCiphers.mockClear();
      cipherRiskService.buildPasswordReuseMap.mockClear();

      await service.refreshVaultHealthReport([login("a")], userId);

      expect(seen).toHaveLength(1);
      // Returns before touching the risk service at all, so an unchanged vault
      // costs neither a breach lookup nor a reuse map.
      expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
      expect(cipherRiskService.buildPasswordReuseMap).not.toHaveBeenCalled();
    });

    it("publishes nothing when only a login's usage data changed", async () => {
      // This is what the fingerprint earns its keep on. cipherViews$ combines
      // localData$, so autofilling a login or launching its URI re-emits the whole
      // vault. That never changes risk and never moves a revision, so it must not
      // cost a rebuild: without this gate every autofill is a full round of breach
      // lookups.
      const scanned = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(scanned, userId);
      const seen = observeStates();
      cipherRiskService.computeRiskForCiphers.mockClear();

      await service.refreshVaultHealthReport([login("a", { lastUsedDate: 1767225600000 })], userId);

      expect(seen).toHaveLength(1);
      expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
    });

    it("never publishes loading, so no scan progress appears over a background update", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      const seen = observeStates();

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]),
        userId,
      );

      expect(seen.map((state) => state.status)).toEqual(["success", "success"]);
    });

    it("keeps the report on screen throughout, never emitting a null report", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      const seen = observeStates();

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]),
        userId,
      );

      expect(seen.every((state) => state.report != null)).toBe(true);
    });

    it("drops a login from its category once its password is fixed", async () => {
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );

      await service.refreshVaultHealthReport(
        withRisks([
          { cipher: editedLogin("a"), risk: risk("a") },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );

      expect(await buckets()).toEqual({ exposed: [], weak: ["b"], reused: [] });
      const report = await currentReport();
      expect(report!.atRiskCount).toBe(1);
      expect(report!.totalCount).toBe(2);
    });

    it("moves a login into its new highest category when its risk worsens", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { strength: 1 }) }]),
        userId,
      );

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a", { strength: 1, exposed: 9 }) }]),
        userId,
      );

      expect(await buckets()).toEqual({ exposed: ["a"], weak: [], reused: [] });
    });

    it("clears the partner login's reuse when one of two shared passwords changes", async () => {
      // Reuse is a whole-vault property, so the login that was not edited has to
      // change too. This is why a refresh rebuilds rather than patching one item.
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a", { password: "shared" }), risk: risk("a", { reuse: 2 }) },
          { cipher: login("b", { password: "shared" }), risk: risk("b", { reuse: 2 }) },
        ]),
        userId,
      );
      expect((await buckets()).reused).toEqual(["a", "b"]);

      await service.refreshVaultHealthReport(
        withRisks([
          { cipher: editedLogin("a", { password: "unique" }), risk: risk("a") },
          { cipher: login("b", { password: "shared" }), risk: risk("b") },
        ]),
        userId,
      );

      expect(await buckets()).toEqual({ exposed: [], weak: [], reused: [] });
      expect((await currentReport())!.atRiskCount).toBe(0);
    });

    it("rebuilds the reuse map across the whole vault, not just the changed login", async () => {
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { strength: 1 }) },
          { cipher: login("b"), risk: risk("b") },
        ]),
        userId,
      );
      cipherRiskService.buildPasswordReuseMap.mockClear();

      await service.refreshVaultHealthReport(
        withRisks([
          { cipher: editedLogin("a"), risk: risk("a") },
          { cipher: login("b"), risk: risk("b") },
        ]),
        userId,
      );

      const passed = cipherRiskService.buildPasswordReuseMap.mock.calls[0][0];
      expect(passed.map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("leaves the list and the counts alone when an edit does not affect risk", async () => {
      // A rename moves the login's revision, so this does rebuild. What matters
      // is that the user sees no change.
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );
      const before = await currentReport();

      await service.refreshVaultHealthReport(
        withRisks([
          { cipher: editedLogin("a"), risk: risk("a", { exposed: 3 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );

      const after = await currentReport();
      expect(after!.atRiskCount).toBe(before!.atRiskCount);
      expect(after!.totalCount).toBe(before!.totalCount);
      expect(await buckets()).toEqual({ exposed: ["a"], weak: ["b"], reused: [] });
    });

    it("surfaces a login that was healthy when the scan ran", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a") }]),
        userId,
      );
      expect((await currentReport())!.atRiskCount).toBe(0);

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a", { strength: 1 }) }]),
        userId,
      );

      expect(await buckets()).toEqual({ exposed: [], weak: ["a"], reused: [] });
    });

    it("picks up a login added to the vault", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { strength: 1 }) }]),
        userId,
      );

      await service.refreshVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { strength: 1 }) },
          { cipher: login("new"), risk: risk("new", { exposed: 2 }) },
        ]),
        userId,
      );

      const report = await currentReport();
      expect(report!.totalCount).toBe(2);
      expect(report!.atRiskCount).toBe(2);
      expect((await buckets()).exposed).toEqual(["new"]);
    });

    it("removes a soft-deleted login without spending a breach lookup on it", async () => {
      // This is what replaces the delete flow's own report surgery.
      await service.buildVaultHealthReport(
        withRisks([
          { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );

      await service.refreshVaultHealthReport([login("a", { deleted: true }), login("b")], userId);

      expect(await buckets()).toEqual({ exposed: [], weak: ["b"], reused: [] });
      const report = await currentReport();
      expect(report!.atRiskCount).toBe(1);
      expect(report!.totalCount).toBe(1);
      const scored = cipherRiskService.computeRiskForCiphers.mock.calls.at(-1)![0];
      expect(scored.map((c) => c.id)).toEqual(["b"]);
    });

    it("scores an emptied vault as 0 rather than NaN", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );

      await service.refreshVaultHealthReport([login("a", { deleted: true })], userId);

      const report = await currentReport();
      expect(report!.totalCount).toBe(0);
      expect(report!.atRiskCount).toBe(0);
      expect(report!.score).toBe(0);
    });

    it("publishes a new report instance, so subscribers already attached see the update", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      const seen = observeStates();

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]),
        userId,
      );

      expect(seen).toHaveLength(2);
      expect(seen[1].report).not.toBe(seen[0].report);
      // the previously published report is left untouched
      expect(cipherIds(seen[0].report!.categoryItems.exposed)).toEqual(["a"]);
    });

    it("keeps the published report and logs when the refresh fails", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      const seen = observeStates();
      const failure = new Error("HIBP unavailable");
      cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(failure);

      await expect(
        service.refreshVaultHealthReport([editedLogin("a")], userId),
      ).resolves.toBeUndefined();

      // Nothing published: a background update must not put a failure view over
      // results the user is already reading.
      expect(seen).toHaveLength(1);
      expect(seen[0].status).toBe(VaultHealthReportStatus.Success);
      expect(cipherIds(seen[0].report!.categoryItems.exposed)).toEqual(["a"]);
      expect(logService.error).toHaveBeenCalledWith("Vault health report refresh failed", failure);
    });

    it("retries the same change after a failed refresh", async () => {
      // The fingerprint must not advance on failure, or the change would be
      // treated as already handled and never reflected.
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );
      cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(new Error("HIBP unavailable"));
      const changed = withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]);
      await service.refreshVaultHealthReport(changed, userId);

      await service.refreshVaultHealthReport(changed, userId);

      expect(await buckets()).toEqual({ exposed: [], weak: [], reused: [] });
    });

    it("skips while a scan is already in flight", async () => {
      // The scan will publish fresher results, and publishing over it would
      // replace its progress view with a stale report.
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );

      let release!: () => void;
      const hangs = new Promise<void>((resolve) => (release = resolve));
      const computeRisk = cipherRiskService.computeRiskForCiphers.getMockImplementation()!;
      cipherRiskService.computeRiskForCiphers.mockImplementationOnce(async (given, id, options) => {
        await hangs;
        return computeRisk(given, id, options);
      });

      const seen = observeStates();
      // buildVaultHealthReport publishes loading before its first await, so the
      // scan is observably in flight by the time the refresh is called.
      const scanning = service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );

      await service.refreshVaultHealthReport([editedLogin("a")], userId);

      // The refresh added nothing of its own; the scan still owns the state.
      expect(seen.map((state) => state.status)).toEqual(["success", "loading"]);
      release();
      await scanning;
    });

    it("drops a refresh that a scan superseded while it was in flight", async () => {
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );

      let release!: () => void;
      const hangs = new Promise<void>((resolve) => (release = resolve));
      const computeRisk = cipherRiskService.computeRiskForCiphers.getMockImplementation()!;
      // Only the refresh's own computation hangs; the scan that overtakes it runs.
      cipherRiskService.computeRiskForCiphers.mockImplementationOnce(async (given, id, options) => {
        await hangs;
        return computeRisk(given, id, options);
      });

      const refreshing = service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]),
        userId,
      );
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("b"), risk: risk("b", { strength: 1 }) }]),
        userId,
      );
      release();
      await refreshing;

      // The scan's report stands; the stale refresh did not overwrite it.
      expect(await buckets()).toEqual({ exposed: [], weak: ["b"], reused: [] });
    });

    it("does not publish one user's refresh into another user's stream", async () => {
      const otherUserId = "other-user-id" as UserId;
      await service.buildVaultHealthReport(
        withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]),
        userId,
      );

      await service.refreshVaultHealthReport(
        withRisks([{ cipher: editedLogin("a"), risk: risk("a") }]),
        otherUserId,
      );

      // The other user has no report to refresh, and this user's is untouched.
      await expect(firstValueFrom(service.getVaultHealthReport$(otherUserId))).resolves.toEqual(
        VAULT_HEALTH_REPORT_IDLE,
      );
      expect((await buckets()).exposed).toEqual(["a"]);
    });
  });
});
