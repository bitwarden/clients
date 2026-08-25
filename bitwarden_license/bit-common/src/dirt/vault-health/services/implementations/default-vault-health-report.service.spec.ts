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

  const login = (
    id: string,
    opts: {
      password?: string;
      organizationId?: string | null;
      deleted?: boolean;
      type?: CipherType;
    } = {},
  ): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.type = opts.type ?? CipherType.Login;
    cipher.organizationId = (opts.organizationId ?? null) as CipherView["organizationId"];
    cipher.deletedDate = opts.deleted ? new Date() : (null as unknown as Date);
    cipher.login = new LoginView();
    cipher.login.password = opts.password ?? `pw-${id}`;
    return cipher;
  };

  const risk = (
    id: string,
    opts: { strength?: number; exposed?: number; reuse?: number } = {},
  ): CipherRiskResult => {
    const exposed = opts.exposed ?? 0;
    return {
      id,
      password_strength: opts.strength ?? 4,
      exposed_result: exposed > 0 ? { type: "Found", value: exposed } : { type: "NotChecked" },
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

  describe("deleteItemFromReport", () => {
    /** Collects every report emitted from now on, so missed emissions are visible. */
    const observeReports = (): VaultHealthReportView[] => {
      const emitted: VaultHealthReportView[] = [];
      service
        .getVaultHealthReport$(userId)
        .pipe(takeUntil(destroy$))
        .subscribe((state) => {
          if (state.report != null) {
            emitted.push(state.report);
          }
        });
      return emitted;
    };

    it("removes the item from the report and decrements counts", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
        { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        { cipher: login("c"), risk: risk("c", { exposed: 2 }) },
      ]);
      await service.buildVaultHealthReport(ciphers, userId);

      service.deleteItemFromReport("a", "exposed", userId);
      const updated = await currentReport();

      expect(updated!.atRiskCount).toBe(2);
      expect(updated!.totalCount).toBe(2);
      expect(cipherIds(updated!.categoryItems.exposed)).toEqual(["c"]);
      expect(cipherIds(updated!.categoryItems.weak)).toEqual(["b"]);
    });

    // Guards against mutating the published report in place: subscribers already
    // attached must see the delete, so a new report instance has to be emitted.
    it("emits the updated report to subscribers attached before the delete", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
        { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        { cipher: login("c"), risk: risk("c", { exposed: 2 }) },
      ]);
      await service.buildVaultHealthReport(ciphers, userId);

      const emitted = observeReports();
      service.deleteItemFromReport("a", "exposed", userId);

      expect(emitted).toHaveLength(2);
      expect(cipherIds(emitted[1].categoryItems.exposed)).toEqual(["c"]);
      expect(emitted[1].atRiskCount).toBe(2);
      expect(emitted[1].totalCount).toBe(2);
      // the previously published report is left untouched
      expect(cipherIds(emitted[0].categoryItems.exposed)).toEqual(["a", "c"]);
      expect(emitted[0].atRiskCount).toBe(3);
    });

    it("recomputes the score from the adjusted counts", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
        { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        { cipher: login("c"), risk: risk("c", { exposed: 2 }) },
        { cipher: login("d"), risk: risk("d") },
      ]);
      await service.buildVaultHealthReport(ciphers, userId);
      expect((await currentReport())!.score).toBe(0.75);

      service.deleteItemFromReport("a", "exposed", userId);
      const updated = await currentReport();

      expect(updated!.score).toBeCloseTo(2 / 3);
    });

    it("scores an emptied report as 0 rather than NaN", async () => {
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(ciphers, userId);

      service.deleteItemFromReport("a", "exposed", userId);
      const updated = await currentReport();

      expect(updated!.totalCount).toBe(0);
      expect(updated!.score).toBe(0);
    });

    it("does nothing if the item is not in the given category", async () => {
      const ciphers = withRisks([
        { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
        { cipher: login("b"), risk: risk("b", { strength: 1 }) },
      ]);
      await service.buildVaultHealthReport(ciphers, userId);

      const emitted = observeReports();
      // "b" is bucketed as weak, so the exposed list must be left alone
      service.deleteItemFromReport("b", "exposed", userId);

      expect(emitted).toHaveLength(1);
      expect(cipherIds(emitted[0].categoryItems.exposed)).toEqual(["a"]);
      expect(cipherIds(emitted[0].categoryItems.weak)).toEqual(["b"]);
      expect(emitted[0].atRiskCount).toBe(2);
      expect(emitted[0].totalCount).toBe(2);
    });

    it("does nothing if the userId does not match the current report", async () => {
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport(ciphers, userId);

      service.deleteItemFromReport("a", "exposed", "other-user-id" as UserId);
      const updated = await currentReport();

      expect(updated!.atRiskCount).toBe(1);
      expect(updated!.totalCount).toBe(1);
      expect(updated!.categoryItems.exposed).toHaveLength(1);
    });
  });
});
