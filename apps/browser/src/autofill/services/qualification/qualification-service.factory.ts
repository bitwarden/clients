import { QualificationEngine } from "../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../qualification/types/engine-id";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";
import { LegacyInlineMenuFieldQualificationService } from "../inline-menu-field-qualification.service";

import { ENGINE_REGISTRY, logEngineSelection } from "./engine-registry";
import { LoggingQualificationEngine } from "./engines/logging.engine";
import { MemoizingQualificationEngine } from "./engines/memoizing.engine";
import { SwappableQualificationEngine } from "./engines/swappable.engine";
import { QualificationEngineAdapter } from "./qualification-engine.adapter";
import { devBuild } from "./qualification-log";

/**
 * The full qualification stack produced by {@link buildQualificationStack}.
 *
 * `service` is what the existing construction sites assign to their
 * `inlineMenuFieldQualificationService` slot — the 35-method legacy boolean
 * interface, backed by an adapter that routes through the selected engine.
 *
 * `engine` is the {@link QualificationEngine} that direct consumers (the
 * fill-time field selection inside `AutofillService`, the diagnostic recording
 * inside `AutofillTriageService`) should depend on for richer output: per-field
 * scores, form classifications, page-level scenarios.
 *
 * Both fields point at machinery that, when used together, shares one
 * classification pass per pageDetails snapshot via the wrapped
 * {@link MemoizingQualificationEngine}.
 *
 * `swap` changes which engine both sides run, in place. Construction sites that
 * can't await their selection source build at the default and call this once
 * the answer arrives; every reference already handed out keeps working. It
 * returns whether anything actually changed, so a caller with work to do on a
 * real swap — `QualificationEngineBackground` broadcasts to every frame of
 * every tab — can skip it for a re-emission of the current selection.
 */
export interface QualificationStack {
  engine: QualificationEngine;
  service: InlineMenuFieldQualificationService;
  swap: (id: QualificationEngineId) => boolean;
}

/**
 * Constructs the qualification stack used by autofill consumers.
 *
 * The engine comes from {@link ENGINE_REGISTRY}, wrapped in a
 * {@link MemoizingQualificationEngine} so adapter-mediated and direct-engine
 * consumers share a single classify pass per pageDetails snapshot, and then in
 * a {@link SwappableQualificationEngine} so the whole thing can be replaced
 * without invalidating references. Adding an engine means registering it, not
 * editing this function.
 *
 * `service` is always a {@link QualificationEngineAdapter}. The adapter routes
 * role and form-category predicates through the engine for whatever it declares
 * covered, falls through to the held legacy service for the rest, and bypasses
 * the engine entirely while a legacy-mirroring one is selected — so the default
 * path costs no more than the concrete legacy service did, and a swap away from
 * it needs no new object. See the adapter's class comment for why the bypass is
 * safe.
 *
 * @param initialId The engine to build now. A site whose selection source is
 *   asynchronous should pass the default and {@link QualificationStack.swap}
 *   later rather than delaying construction.
 */
export function buildQualificationStack(initialId: QualificationEngineId): QualificationStack {
  const legacy = new LegacyInlineMenuFieldQualificationService();
  const engine = new SwappableQualificationEngine(
    (id) => new MemoizingQualificationEngine(observed(ENGINE_REGISTRY[id]({ legacy }))),
    initialId,
  );
  const service = new QualificationEngineAdapter(engine, legacy);

  return {
    engine,
    service,
    swap: (id) => {
      const changed = engine.swap(id);
      if (changed) {
        logEngineSelection(engine, "swap");
      }
      return changed;
    },
  };
}

/**
 * Adds per-page classification logging on development builds.
 *
 * Wrapped *inside* the memoizing decorator on purpose, so the dump fires once
 * per snapshot rather than once per predicate query — see
 * {@link LoggingQualificationEngine}. `devBuild()` is a build-time constant, so
 * production keeps the undecorated engine.
 */
function observed(engine: QualificationEngine): QualificationEngine {
  return devBuild() ? new LoggingQualificationEngine(engine) : engine;
}

/**
 * Convenience entry point for construction sites that only need the
 * boolean-interface service. Equivalent to `buildQualificationStack(id).service`.
 * Prefer {@link buildQualificationStack} when the engine itself is also needed,
 * or when the site has to swap later.
 *
 * `context` names the construction site for the dev-build selection log, e.g.
 * `"content-script"` or `"background"`.
 */
export function createInlineMenuFieldQualificationService(
  id: QualificationEngineId,
  context: string,
): InlineMenuFieldQualificationService {
  const stack = buildQualificationStack(id);
  logEngineSelection(stack.engine, context);
  return stack.service;
}
