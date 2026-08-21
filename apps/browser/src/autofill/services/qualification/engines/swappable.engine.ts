import { QualificationEngine } from "../../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../../qualification/types/engine-id";

import { ForwardingQualificationEngine } from "./forwarding.engine";

/**
 * Wraps a {@link QualificationEngine} behind a stable reference whose inner
 * engine can be replaced at runtime.
 *
 * Construction sites that cannot await their selection source build at the
 * default and swap once the answer arrives: the background subscribes to
 * `FeatureFlag.AutofillQualificationEngine`, and the content scripts are pushed
 * the resolved id over the channel `AutofillInit` already establishes. Both
 * hand out this object before either knows what it should be running, so its
 * identity has to survive the change — see `qualification/engine-selection.design.md`.
 *
 * **Composition.** This sits *outside* the memoizing decorator, not inside it.
 * A swap therefore replaces the memoizer along with the engine, and no verdict
 * from the previous engine can be served out of a warm cache. The alternative —
 * memoizing on the outside and clearing on swap — leaves a window where the
 * clear is forgotten, and the symptom is silently stale classifications rather
 * than an error.
 *
 * Identity, coverage and {@link QualificationEngine.mirrorsLegacy} come from
 * {@link ForwardingQualificationEngine}, which reads them off the *current*
 * inner engine on every access. A caller that asks which engine is running has
 * to get the answer for the engine that is running now, not the one this object
 * was born holding.
 */
export class SwappableQualificationEngine extends ForwardingQualificationEngine {
  /**
   * @param build Constructs the fully decorated engine for an id. The factory
   *   owns decoration order; this class only owns *when* a rebuild happens.
   * @param initialId The engine to build before any selection source has spoken.
   */
  constructor(
    private readonly build: (id: QualificationEngineId) => QualificationEngine,
    initialId: QualificationEngineId,
  ) {
    super(build(initialId));
  }

  /**
   * Replaces the inner engine. A swap to the id already running is a no-op, so
   * a selection source that re-emits the same value doesn't discard a warm
   * memo cache.
   *
   * Returns whether the engine actually changed. Callers propagate this rather
   * than dropping it: `QualificationEngineBackground` gates a broadcast to
   * every frame of every tab on it, and an MV3 service worker restart re-emits
   * the current selection often enough that the difference is the whole cost.
   */
  swap(id: QualificationEngineId): boolean {
    if (this.inner.id === id) {
      return false;
    }
    this.inner = this.build(id);
    return true;
  }
}
