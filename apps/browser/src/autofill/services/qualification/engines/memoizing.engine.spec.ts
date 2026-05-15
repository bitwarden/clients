import { mock, MockProxy } from "jest-mock-extended";

import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";

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
});
