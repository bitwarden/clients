import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "../risk-category";

import { VaultHealthReportView } from "./vault-health-report.view";

describe("VaultHealthReportView", () => {
  /** A login's health, healthy unless a risk is asked for. */
  const health = (
    cipherId: string,
    risks: { exposed?: number; weak?: number; reuse?: number } = {},
  ): CipherHealthView => {
    const exposedCount = risks.exposed ?? 0;
    const reuseCount = risks.reuse ?? 1;
    // Matches the service's thresholds: exposed > 0, strength < 3, reuse > 1.
    const weakPasswordScore = risks.weak ?? 4;
    return new CipherHealthView({
      cipherId,
      hasExposedPassword: exposedCount > 0,
      hasWeakPassword: weakPasswordScore < 3,
      hasReusedPassword: reuseCount > 1,
      exposedCount,
      reuseCount,
      weakPasswordScore,
    });
  };

  /** The cipher ids bucketed into a category, in order. */
  const ids = (items: CipherHealthView[]): string[] => items.map((item) => item.cipherId);

  describe("fromCipherHealth", () => {
    it.each([
      ["exposed", { exposed: 3 }, RiskCategory.Exposed],
      ["weak", { weak: 1 }, RiskCategory.Weak],
      ["reused", { reuse: 2 }, RiskCategory.Reused],
    ])("places a %s login in its matching category", (_label, risks, category) => {
      const report = VaultHealthReportView.fromCipherHealth([health("a", risks)], 1);

      expect(ids(report.categoryItems[category])).toEqual(["a"]);
      expect(report.atRiskCount).toBe(1);
    });

    it("counts an exposed, weak and reused login once, under Exposed", () => {
      const report = VaultHealthReportView.fromCipherHealth(
        [health("a", { exposed: 5, weak: 1, reuse: 3 })],
        1,
      );

      expect(report.atRiskCount).toBe(1);
      expect(ids(report.categoryItems.exposed)).toEqual(["a"]);
      expect(report.categoryItems.weak).toHaveLength(0);
      expect(report.categoryItems.reused).toHaveLength(0);
    });

    it("places a weak and reused login under Weak", () => {
      const report = VaultHealthReportView.fromCipherHealth(
        [health("a", { weak: 2, reuse: 4 })],
        1,
      );

      expect(ids(report.categoryItems.weak)).toEqual(["a"]);
      expect(report.categoryItems.reused).toHaveLength(0);
    });

    it("keeps every risk on the bucketed item, so the cross-category view survives bucketing", () => {
      // The delete dialog reads the lower categories off the item it was given
      // rather than searching the other buckets for it.
      const report = VaultHealthReportView.fromCipherHealth(
        [health("a", { exposed: 5, weak: 1, reuse: 3 })],
        1,
      );

      const [bucketed] = report.categoryItems.exposed;
      expect(bucketed.hasExposedPassword).toBe(true);
      expect(bucketed.hasWeakPassword).toBe(true);
      expect(bucketed.hasReusedPassword).toBe(true);
    });

    it("counts healthy logins in the total but leaves them out of every category", () => {
      const report = VaultHealthReportView.fromCipherHealth(
        [health("a", { weak: 1 }), health("healthy-1"), health("healthy-2")],
        3,
      );

      expect(report.totalCount).toBe(3);
      expect(report.atRiskCount).toBe(1);
      expect(ids(report.categoryItems.weak)).toEqual(["a"]);
      expect(report.categoryItems.exposed).toHaveLength(0);
      expect(report.categoryItems.reused).toHaveLength(0);
    });

    it("scores at-risk logins over the total", () => {
      const views = Array.from({ length: 10 }, (_, i) =>
        i < 3 ? health(`c${i}`, { weak: 1 }) : health(`c${i}`),
      );

      const report = VaultHealthReportView.fromCipherHealth(views, 10);

      expect(report.score).toBeCloseTo(0.3);
    });

    it("scores an empty vault as 0 rather than NaN", () => {
      const report = VaultHealthReportView.fromCipherHealth([], 0);

      expect(report.totalCount).toBe(0);
      expect(report.atRiskCount).toBe(0);
      expect(report.score).toBe(0);
      expect(report.categoryItems.exposed).toHaveLength(0);
      expect(report.categoryItems.weak).toHaveLength(0);
      expect(report.categoryItems.reused).toHaveLength(0);
    });

    it("scores against the given total, not the number of health results", () => {
      // The denominator is the logins the caller scoped. A caller that scopes
      // more logins than it has results for must not have its score inflated.
      const report = VaultHealthReportView.fromCipherHealth([health("a", { weak: 1 })], 4);

      expect(report.totalCount).toBe(4);
      expect(report.atRiskCount).toBe(1);
      expect(report.score).toBeCloseTo(0.25);
    });

    it("preserves input order within a category", () => {
      const report = VaultHealthReportView.fromCipherHealth(
        [health("a", { exposed: 1 }), health("b", { exposed: 2 }), health("c", { exposed: 3 })],
        3,
      );

      expect(ids(report.categoryItems.exposed)).toEqual(["a", "b", "c"]);
    });

    it("returns a distinct instance per call, so a published report is never mutated in place", () => {
      // getVaultHealthReport$ dedupes on report identity, so a rebuild has to
      // produce a new instance to reach subscribers.
      const views = [health("a", { weak: 1 })];

      const first = VaultHealthReportView.fromCipherHealth(views, 1);
      const second = VaultHealthReportView.fromCipherHealth(views, 1);

      expect(first).not.toBe(second);
      expect(first.categoryItems).not.toBe(second.categoryItems);
      expect(first.categoryItems.weak).not.toBe(second.categoryItems.weak);
    });
  });
});
