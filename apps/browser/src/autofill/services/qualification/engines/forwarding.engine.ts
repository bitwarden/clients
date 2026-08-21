import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../../qualification/types/engine-id";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";

/**
 * Base class for engine decorators. Forwards everything an engine declares
 * about itself to the wrapped engine, leaving subclasses to override only the
 * behavior they exist to change.
 *
 * **Why a base class and not three copies.** Every declared member has to
 * round-trip: a caller asking which engine is running, what it covers, or
 * whether it mirrors the legacy predicates must get the answer for the engine
 * actually doing the work, not for the wrapper. A decorator that drops one is
 * not a compile error — the member is optional on the port — and the symptom is
 * a silent wrong answer rather than a failure. `coveredRoles` dropped makes an
 * engine claim roles it can't emit; `mirrorsLegacy` dropped puts every user on
 * the eager whole-page pass. Adding a member to the port should mean editing
 * one file, not remembering three.
 *
 * Every accessor reads {@link inner} per call rather than caching, because
 * `SwappableQualificationEngine` reassigns it at runtime.
 */
export abstract class ForwardingQualificationEngine implements QualificationEngine {
  /**
   * The engine being wrapped. Mutable rather than `readonly` so
   * `SwappableQualificationEngine` can replace it; no other subclass should.
   */
  protected constructor(protected inner: QualificationEngine) {}

  get id(): QualificationEngineId {
    return this.inner.id;
  }

  get name(): string {
    return this.inner.name;
  }

  get version(): string {
    return this.inner.version;
  }

  get coveredRoles(): ReadonlySet<FieldRole> | undefined {
    return this.inner.coveredRoles;
  }

  get coveredCategories(): ReadonlySet<FormCategory> | undefined {
    return this.inner.coveredCategories;
  }

  get mirrorsLegacy(): boolean | undefined {
    return this.inner.mirrorsLegacy;
  }

  classify(pageDetails: AutofillPageDetails): PageQualification {
    return this.inner.classify(pageDetails);
  }
}
