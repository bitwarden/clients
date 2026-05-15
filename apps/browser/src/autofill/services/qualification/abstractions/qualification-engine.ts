import AutofillPageDetails from "../../../models/autofill-page-details";
import { FieldClassification, FormClassification } from "../types/classification";
import { PageScenario } from "../types/page-scenario";

/**
 * Whole-page qualification result returned by a QualificationEngine.
 *
 * Lookups go through getter methods rather than eager Maps so that engines
 * which fetch results lazily (remote, async) can return immediately and
 * populate their internal cache on demand. A getter that has no answer yet
 * returns null; the adapter maps that to a "false" boolean and re-queries
 * on the next pageDetails collection.
 */
export interface PageQualification {
  fieldFor(opid: string): FieldClassification | null;
  formFor(opid: string): FormClassification | null;
  scenario(): PageScenario | null;
  /**
   * Resolves when the engine has finished classifying. Engines that produce
   * eager, synchronous results omit this. Remote engines may expose it so
   * consumers that want to await full classification can.
   */
  ready?: Promise<void>;
}

/**
 * Single-method port that alternative qualification engines implement.
 * The unit of work is a full `AutofillPageDetails` snapshot — the engine
 * sees every field, every form, and every form-level signal at once.
 *
 * **Two consumption styles:**
 *
 * 1. **Through the boolean adapter** — when a consumer needs the legacy
 *    35-method `InlineMenuFieldQualificationService` interface. Each
 *    predicate maps to a `matchedRoles.has(...)` or `matchedFormContexts.has(...)`
 *    lookup against the engine's classification. Use when the consumer was
 *    written against the legacy interface and isn't being refactored.
 *
 * 2. **Directly, bypassing the adapter** — when a consumer can benefit from
 *    richer output: scores, confidence bands, form classifications,
 *    per-field trace, or page-level scenarios. The fill-time field selection
 *    in `AutofillService` (e.g. `findUsernameField`) and the diagnostic
 *    recording in `AutofillTriageService` are natural direct consumers.
 *
 * Both styles can coexist on the same engine instance. Pair with
 * `MemoizingQualificationEngine` (see `engines/memoizing.engine.ts`) so
 * adapter-mediated and direct consumers share one classify pass per
 * `AutofillPageDetails` snapshot.
 */
export interface QualificationEngine {
  classify(pageDetails: AutofillPageDetails): PageQualification;
}
