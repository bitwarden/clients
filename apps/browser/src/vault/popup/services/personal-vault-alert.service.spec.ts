import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";

import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { AlertExclusionId, CipherId, UserId } from "@bitwarden/common/types/guid";
import {
  CipherRiskCounts,
  CipherRiskService,
  PersonalVaultRiskSummary,
  PersonalVaultRiskUpdate,
} from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { AlertExclusionService } from "@bitwarden/common/vault/alert-exclusions";
import { CipherRiskTypes } from "@bitwarden/common/vault/enums/cipher-risk-types";
import { AlertExclusionData } from "@bitwarden/common/vault/models/data/alert-exclusion.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { PersonalVaultAlertService } from "./personal-vault-alert.service";

describe("PersonalVaultAlertService", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let service: PersonalVaultAlertService;
  let updates$: Subject<PersonalVaultRiskUpdate>;
  let exclusions$: BehaviorSubject<AlertExclusionData[]>;
  let cipherRiskService: MockProxy<CipherRiskService>;
  let alertExclusionService: MockProxy<AlertExclusionService>;

  const cipherView = (id: string): CipherView => {
    const c = new CipherView();
    c.id = id;
    return c;
  };

  const summary = (
    overrides: Partial<PersonalVaultRiskSummary> = {},
  ): PersonalVaultRiskSummary => ({
    exposed: [],
    weak: [],
    reused: [],
    riskCounts: new Map<CipherId, CipherRiskCounts>(),
    scannedAt: new Date("2026-05-14T00:00:00Z"),
    ...overrides,
  });

  const exclusion = (id: string, cipherId: string, riskTypes: number = 0): AlertExclusionData =>
    ({
      id: id as AlertExclusionId,
      cipherId: cipherId as CipherId,
      excludedAt: new Date(),
      notes: null,
      riskTypes,
    }) as AlertExclusionData;

  beforeEach(() => {
    updates$ = new Subject<PersonalVaultRiskUpdate>();
    exclusions$ = new BehaviorSubject<AlertExclusionData[]>([]);

    cipherRiskService = mock<CipherRiskService>();
    cipherRiskService.computeRiskForPersonalVault.mockImplementation(() => updates$.asObservable());

    alertExclusionService = mock<AlertExclusionService>();
    alertExclusionService.exclusions$.mockReturnValue(exclusions$);

    const accountService = mockAccountServiceWith(userId);

    service = new PersonalVaultAlertService(
      accountService,
      cipherRiskService,
      alertExclusionService,
    );
  });

  describe("isScanning$", () => {
    it("starts false when no downstream consumer has triggered a scan", async () => {
      expect(await firstValueFrom(service.isScanning$)).toBe(false);
    });

    it("flips to true as soon as a downstream consumer kicks off a scan", async () => {
      const summarySub = service.summary$.subscribe();
      expect(await firstValueFrom(service.isScanning$)).toBe(true);
      summarySub.unsubscribe();
    });

    it("flips back to false when the scan subscription is torn down (finalize)", async () => {
      const seen: boolean[] = [];
      const scanSub = service.isScanning$.subscribe((v) => seen.push(v));
      const summarySub = service.summary$.subscribe();
      summarySub.unsubscribe();

      // finalize on the inner observable fires once shareReplay's last downstream subscriber leaves.
      expect(seen[seen.length - 1]).toBe(false);

      scanSub.unsubscribe();
    });
  });

  describe("progress$", () => {
    it("emits only progress events", async () => {
      const seen: PersonalVaultRiskUpdate[] = [];
      const sub = service.progress$.subscribe((p) => seen.push(p));

      updates$.next({
        type: "progress",
        phase: "preparing",
        processed: 0,
        total: 10,
        percent: 0,
      });
      updates$.next({ type: "result", summary: summary() });
      updates$.next({
        type: "progress",
        phase: "checkingBreaches",
        processed: 10,
        total: 10,
        percent: 100,
      });

      expect(seen).toEqual([
        { type: "progress", phase: "preparing", processed: 0, total: 10, percent: 0 },
        {
          type: "progress",
          phase: "checkingBreaches",
          processed: 10,
          total: 10,
          percent: 100,
        },
      ]);

      sub.unsubscribe();
    });
  });

  describe("summary$", () => {
    it("filters a cipher out of a category only when its exclusion covers that risk type", async () => {
      // c2 is excluded for Weak only, so it must still surface in Exposed.
      // c3 is excluded for Exposed and Reused; it appears in Reused this scan and must be hidden.
      const c1 = cipherView("c1");
      const c2 = cipherView("c2");
      const c3 = cipherView("c3");
      exclusions$.next([
        exclusion("e1", "c2", CipherRiskTypes.Weak),
        exclusion("e2", "c3", CipherRiskTypes.Exposed | CipherRiskTypes.Reused),
      ]);

      const pending = firstValueFrom(service.summary$);
      updates$.next({
        type: "result",
        summary: summary({ exposed: [c1, c2], weak: [c2], reused: [c3] }),
      });

      const result = await pending;
      expect(result.exposed.map((c) => c.id)).toEqual(["c1", "c2"]);
      expect(result.weak).toEqual([]);
      expect(result.reused).toEqual([]);
      expect(result.totalCount).toBe(2);
    });

    it("treats a None mask (legacy / migrated rows) as covering no category", async () => {
      const c1 = cipherView("c1");
      exclusions$.next([exclusion("e1", "c1", CipherRiskTypes.None)]);

      const pending = firstValueFrom(service.summary$);
      updates$.next({
        type: "result",
        summary: summary({ weak: [c1] }),
      });

      const result = await pending;
      expect(result.weak.map((c) => c.id)).toEqual(["c1"]);
    });

    it("preserves riskCounts and scannedAt from the raw summary", async () => {
      const c1 = cipherView("c1");
      const counts = new Map<CipherId, CipherRiskCounts>([
        ["c1" as CipherId, { exposedBreaches: 3, reuseCount: 1, weak: false }],
      ]);
      const scannedAt = new Date("2026-01-01T00:00:00Z");

      const pending = firstValueFrom(service.summary$);
      updates$.next({
        type: "result",
        summary: { exposed: [c1], weak: [], reused: [], riskCounts: counts, scannedAt },
      });

      const result = await pending;
      expect(result.riskCounts).toBe(counts);
      expect(result.scannedAt).toBe(scannedAt);
    });

    it("re-emits when exclusions change without re-running the scan", async () => {
      const c1 = cipherView("c1");
      const c2 = cipherView("c2");

      const seen: number[] = [];
      const sub = service.summary$.subscribe((s) => seen.push(s.totalCount));

      updates$.next({
        type: "result",
        summary: summary({ exposed: [c1, c2] }),
      });
      exclusions$.next([exclusion("e1", "c1", CipherRiskTypes.Exposed)]);

      expect(seen).toEqual([2, 1]);
      expect(cipherRiskService.computeRiskForPersonalVault).toHaveBeenCalledTimes(1);

      sub.unsubscribe();
    });
  });

  describe("totalCount$", () => {
    it("equals exposed + weak + reused after filtering", async () => {
      const c1 = cipherView("c1");
      const c2 = cipherView("c2");
      const c3 = cipherView("c3");

      const pending = firstValueFrom(service.totalCount$);
      updates$.next({
        type: "result",
        summary: summary({ exposed: [c1], weak: [c2], reused: [c3] }),
      });

      expect(await pending).toBe(3);
    });
  });

  describe("rawSummary$", () => {
    it("emits the unfiltered scan summary", async () => {
      const c1 = cipherView("c1");
      const pending = firstValueFrom(service.rawSummary$);

      updates$.next({
        type: "result",
        summary: summary({ exposed: [c1] }),
      });

      const result = await pending;
      expect(result.exposed).toEqual([c1]);
    });
  });

  describe("autoUndismiss$", () => {
    it("removes exclusions whose riskTypes do not cover a current risk on the cipher", async () => {
      // c1 was excluded for Weak only; the scan now flags it as Exposed too → remove the exclusion.
      const c1 = cipherView("c1");
      alertExclusionService.removeExclusion.mockResolvedValue(undefined);
      exclusions$.next([exclusion("e1", "c1", CipherRiskTypes.Weak)]);

      const sub = service.autoUndismiss$.subscribe();
      updates$.next({
        type: "result",
        summary: summary({
          exposed: [c1],
          weak: [c1],
          riskCounts: new Map<CipherId, CipherRiskCounts>([
            ["c1" as CipherId, { exposedBreaches: 2, reuseCount: 1, weak: true }],
          ]),
        }),
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(alertExclusionService.removeExclusion).toHaveBeenCalledWith("e1", userId);
      sub.unsubscribe();
    });

    it("does NOT remove exclusions whose riskTypes still cover every current risk", async () => {
      // c1 was excluded for Weak; the scan still only flags it as Weak → keep the exclusion.
      const c1 = cipherView("c1");
      exclusions$.next([exclusion("e1", "c1", CipherRiskTypes.Weak)]);

      const sub = service.autoUndismiss$.subscribe();
      updates$.next({
        type: "result",
        summary: summary({
          weak: [c1],
          riskCounts: new Map<CipherId, CipherRiskCounts>([
            ["c1" as CipherId, { exposedBreaches: 0, reuseCount: 1, weak: true }],
          ]),
        }),
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(alertExclusionService.removeExclusion).not.toHaveBeenCalled();
      sub.unsubscribe();
    });

    it("does NOT remove exclusions for ciphers that have no current risk this scan", async () => {
      // The cipher no longer has risk this scan; keep the exclusion record.
      exclusions$.next([exclusion("e1", "c1", CipherRiskTypes.Weak)]);

      const sub = service.autoUndismiss$.subscribe();
      updates$.next({ type: "result", summary: summary() });
      await Promise.resolve();
      await Promise.resolve();

      expect(alertExclusionService.removeExclusion).not.toHaveBeenCalled();
      sub.unsubscribe();
    });
  });

  describe("shareReplay", () => {
    it("two simultaneous subscribers share a single scan invocation", () => {
      const a = service.summary$.subscribe();
      const b = service.summary$.subscribe();

      expect(cipherRiskService.computeRiskForPersonalVault).toHaveBeenCalledTimes(1);

      a.unsubscribe();
      b.unsubscribe();
    });

    it("late subscriber receives the replayed result without re-running the scan", async () => {
      const a = service.summary$.subscribe();
      updates$.next({
        type: "result",
        summary: summary({ weak: [cipherView("c1")] }),
      });

      const replayed = await firstValueFrom(service.summary$);
      expect(replayed.totalCount).toBe(1);
      expect(cipherRiskService.computeRiskForPersonalVault).toHaveBeenCalledTimes(1);

      a.unsubscribe();
    });
  });
});
