import { mock, MockProxy } from "jest-mock-extended";

import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../../qualification/types/engine-id";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";

import { MemoizingQualificationEngine } from "./memoizing.engine";

describe("MemoizingQualificationEngine", () => {
  let inner: MockProxy<QualificationEngine>;
  let memoizing: MemoizingQualificationEngine;
  let pageDetailsA: AutofillPageDetails;
  let pageDetailsB: AutofillPageDetails;
  let resultA: PageQualification;
  let resultB: PageQualification;

  beforeEach(() => {
    inner = mock<QualificationEngine>();
    memoizing = new MemoizingQualificationEngine(inner);
    pageDetailsA = mock<AutofillPageDetails>({ forms: {}, fields: [] });
    pageDetailsB = mock<AutofillPageDetails>({ forms: {}, fields: [] });
    resultA = mock<PageQualification>();
    resultB = mock<PageQualification>();
  });

  it("calls the inner engine exactly once per unique pageDetails reference", () => {
    inner.classify.mockReturnValue(resultA);

    memoizing.classify(pageDetailsA);
    memoizing.classify(pageDetailsA);
    memoizing.classify(pageDetailsA);

    expect(inner.classify).toHaveBeenCalledTimes(1);
  });

  it("returns the same PageQualification instance for the same pageDetails", () => {
    inner.classify.mockReturnValue(resultA);

    const first = memoizing.classify(pageDetailsA);
    const second = memoizing.classify(pageDetailsA);

    expect(second).toBe(first);
  });

  it("classifies distinct pageDetails snapshots independently", () => {
    inner.classify.mockReturnValueOnce(resultA).mockReturnValueOnce(resultB);

    const a = memoizing.classify(pageDetailsA);
    const b = memoizing.classify(pageDetailsB);

    expect(a).toBe(resultA);
    expect(b).toBe(resultB);
    expect(inner.classify).toHaveBeenCalledTimes(2);
  });

  it("does not cross-contaminate cache entries between snapshots", () => {
    inner.classify.mockReturnValueOnce(resultA).mockReturnValueOnce(resultB);
    memoizing.classify(pageDetailsA);
    memoizing.classify(pageDetailsB);

    expect(memoizing.classify(pageDetailsA)).toBe(resultA);
    expect(memoizing.classify(pageDetailsB)).toBe(resultB);
    // Still only two inner calls total — the repeat queries are cached.
    expect(inner.classify).toHaveBeenCalledTimes(2);
  });

  describe("delegation", () => {
    // A plain stub rather than mock<QualificationEngine>(): jest-mock-extended
    // deep-proxies Set values, so the identity assertions below would compare a
    // proxy against the original.
    const stubEngine = (overrides: Partial<QualificationEngine>): QualificationEngine => ({
      id: QualificationEngineId.Legacy,
      name: "Stub",
      version: "0.0.0",
      classify: () => mock<PageQualification>(),
      ...overrides,
    });

    it("reports the inner engine's identity, so selection survives wrapping", () => {
      const identified = new MemoizingQualificationEngine(
        stubEngine({
          id: QualificationEngineId.Scoring,
          name: "Scoring Qualification Engine",
          version: "0.2.0",
        }),
      );

      expect(identified.id).toBe(QualificationEngineId.Scoring);
      expect(identified.name).toBe("Scoring Qualification Engine");
      expect(identified.version).toBe("0.2.0");
    });

    it("forwards coverage declarations so the adapter still falls through", () => {
      const roles = new Set([FieldRole.Username]);
      const categories = new Set([FormCategory.Login]);
      const covered = new MemoizingQualificationEngine(
        stubEngine({ coveredRoles: roles, coveredCategories: categories }),
      );

      expect(covered.coveredRoles).toBe(roles);
      expect(covered.coveredCategories).toBe(categories);
    });

    it("preserves an inner engine's absent coverage as absent, not empty", () => {
      // The adapter reads undefined as "covers everything" and an empty set as
      // "covers nothing" — collapsing the two would invert routing entirely.
      const uncovered = new MemoizingQualificationEngine(stubEngine({}));

      expect(uncovered.coveredRoles).toBeUndefined();
      expect(uncovered.coveredCategories).toBeUndefined();
    });
  });
});
