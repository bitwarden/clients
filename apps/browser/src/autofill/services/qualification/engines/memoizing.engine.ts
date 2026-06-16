import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";

/**
 * Wraps any {@link QualificationEngine} with `WeakMap`-keyed memoization so
 * multiple consumers that classify the same {@link AutofillPageDetails}
 * snapshot share one classification pass.
 *
 * Cache entries are keyed on `AutofillPageDetails` object identity and GC
 * themselves when the snapshot is replaced. The inner engine sees one call
 * per unique snapshot regardless of how many consumers query it.
 *
 * Intended composition: the qualification-service factory wraps the
 * configured engine in this class before handing it out. The
 * {@link QualificationEngineAdapter} and any direct-engine consumers (e.g.
 * a future fill-time qualifier inside `AutofillService`) hold the same
 * wrapped reference and benefit from a shared cache.
 */
export class MemoizingQualificationEngine implements QualificationEngine {
  private readonly cache = new WeakMap<AutofillPageDetails, PageQualification>();

  constructor(private readonly inner: QualificationEngine) {}

  classify(pageDetails: AutofillPageDetails): PageQualification {
    // Use `has` rather than a falsy check on the result so an engine that
    // legitimately returns a falsy-looking PageQualification (none today, but
    // not precluded by the interface) is not misclassified as a cache miss.
    if (!this.cache.has(pageDetails)) {
      this.cache.set(pageDetails, this.inner.classify(pageDetails));
    }
    return this.cache.get(pageDetails) as PageQualification;
  }
}
