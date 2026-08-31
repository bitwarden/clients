import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../../qualification/types/engine-id";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";

import { LoggingQualificationEngine } from "./logging.engine";
import { MemoizingQualificationEngine } from "./memoizing.engine";
import { SwappableQualificationEngine } from "./swappable.engine";

/**
 * One inner engine that declares *every* optional member of the port, so a
 * decorator that silently drops one shows up as an undefined here.
 */
function declaredEngine(): QualificationEngine {
  return {
    id: QualificationEngineId.Scoring,
    name: "Inner",
    version: "9.9.9",
    coveredRoles: new Set([FieldRole.Username]),
    coveredCategories: new Set([FormCategory.Login]),
    mirrorsLegacy: true,
    classify: () => ({ fieldFor: () => null, formFor: () => null, scenario: () => null }),
  };
}

const decorators: ReadonlyArray<[string, (inner: QualificationEngine) => QualificationEngine]> = [
  ["MemoizingQualificationEngine", (inner) => new MemoizingQualificationEngine(inner)],
  ["LoggingQualificationEngine", (inner) => new LoggingQualificationEngine(inner)],
  [
    "SwappableQualificationEngine",
    (inner) => new SwappableQualificationEngine(() => inner, inner.id),
  ],
];

/**
 * Nothing a decorator forwards is enforced by the compiler — every member below
 * is optional on {@link QualificationEngine}, so dropping one is not an error,
 * and the symptom is a wrong answer rather than a failure. `coveredRoles`
 * dropped makes an engine claim roles it can't emit; `mirrorsLegacy` dropped
 * puts every user on the eager whole-page pass. This is the test that makes
 * adding a member to the port fail loudly until every wrapper carries it.
 */
describe("ForwardingQualificationEngine", () => {
  describe.each(decorators)("%s", (_name, wrap) => {
    it("round-trips everything the inner engine declares about itself", () => {
      const inner = declaredEngine();
      const wrapped = wrap(inner);

      expect(wrapped.id).toBe(inner.id);
      expect(wrapped.name).toBe(inner.name);
      expect(wrapped.version).toBe(inner.version);
      expect(wrapped.coveredRoles).toBe(inner.coveredRoles);
      expect(wrapped.coveredCategories).toBe(inner.coveredCategories);
      expect(wrapped.mirrorsLegacy).toBe(true);
    });

    it("preserves an absent declaration as absent rather than defaulting it", () => {
      // The adapter reads absent coverage as "covers everything" and absent
      // `mirrorsLegacy` as "do route through me". A decorator that substituted
      // an empty Set or `false` would change routing, not just reporting.
      const inner: QualificationEngine = {
        id: QualificationEngineId.Autocomplete,
        name: "Bare",
        version: "1.0.0",
        classify: () => ({ fieldFor: () => null, formFor: () => null, scenario: () => null }),
      };
      const wrapped = wrap(inner);

      expect(wrapped.coveredRoles).toBeUndefined();
      expect(wrapped.coveredCategories).toBeUndefined();
      expect(wrapped.mirrorsLegacy).toBeUndefined();
    });

    it("delegates classify", () => {
      const result: PageQualification = {
        fieldFor: () => null,
        formFor: () => null,
        scenario: () => null,
      };
      const classify = jest.fn().mockReturnValue(result);
      const wrapped = wrap({ ...declaredEngine(), classify });
      const pageDetails = new AutofillPageDetails();
      pageDetails.fields = [];
      pageDetails.forms = {};

      expect(wrapped.classify(pageDetails)).toBe(result);
      expect(classify).toHaveBeenCalledWith(pageDetails);
    });
  });
});
