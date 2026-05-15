import { QualificationEngine } from "../../qualification/abstractions/qualification-engine";
import { ScoringQualificationEngine } from "../../qualification/engine";
import { InlineMenuFieldQualificationService as InlineMenuFieldQualificationServiceInterface } from "../abstractions/inline-menu-field-qualifications.service";
import { InlineMenuFieldQualificationService } from "../inline-menu-field-qualification.service";

import { LegacyBridgeEngine } from "./engines/legacy-bridge.engine";
import { MemoizingQualificationEngine } from "./engines/memoizing.engine";
import { QualificationEngineAdapter } from "./qualification-engine.adapter";

/**
 * The full qualification stack produced by {@link buildQualificationStack}.
 *
 * `service` is what the four existing construction sites assign to their
 * `inlineMenuFieldQualificationService` slot — the 35-method legacy boolean
 * interface either as the legacy concrete class or as an adapter routing
 * through an engine.
 *
 * `engine` is the {@link QualificationEngine} that direct consumers (the
 * future fill-time qualifier inside `AutofillService`, the diagnostic
 * recording inside `AutofillTriageService`) should depend on for richer
 * output: per-field scores, form classifications, page-level scenarios.
 *
 * Both fields point at machinery that, when used together, shares one
 * classification pass per pageDetails snapshot via the wrapped
 * {@link MemoizingQualificationEngine}.
 */
export interface QualificationStack {
  engine: QualificationEngine;
  service: InlineMenuFieldQualificationServiceInterface;
}

/**
 * Constructs the qualification stack used by autofill consumers.
 *
 * With `useEngine=false`, returns the legacy concrete service as `service`
 * — identical to today's `new InlineMenuFieldQualificationService()`. An
 * engine is still returned (built from the legacy bridge) so future
 * direct-engine consumers behave consistently regardless of the inline-menu
 * flag state.
 *
 * With `useEngine=true`, returns a {@link QualificationEngineAdapter} as
 * `service` backed by the {@link ScoringQualificationEngine}. The adapter
 * routes role and form-category predicates through the scoring engine when
 * the engine declares them covered (credential roles + login/account-creation
 * categories today), and falls through to the held legacy service for the
 * uncovered remainder (card and identity roles, credit-card and identity
 * categories). Both go through one {@link MemoizingQualificationEngine}, so
 * adapter-mediated and direct-engine consumers share a single classify pass
 * per pageDetails snapshot.
 */
export function buildQualificationStack(useEngine: boolean): QualificationStack {
  const legacy = new InlineMenuFieldQualificationService();
  const inner = useEngine ? new ScoringQualificationEngine() : new LegacyBridgeEngine(legacy);
  const engine = new MemoizingQualificationEngine(inner);
  const service = useEngine ? new QualificationEngineAdapter(engine, legacy) : legacy;
  return { engine, service };
}

/**
 * Convenience entry point for construction sites that only need the
 * boolean-interface service. Equivalent to
 * `buildQualificationStack(useEngine).service`. Prefer
 * {@link buildQualificationStack} when the engine itself is also needed.
 */
export function createInlineMenuFieldQualificationService(
  useEngine: boolean,
): InlineMenuFieldQualificationServiceInterface {
  return buildQualificationStack(useEngine).service;
}
