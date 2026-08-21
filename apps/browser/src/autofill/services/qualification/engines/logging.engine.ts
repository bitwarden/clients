import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { FieldClassification } from "../../../qualification/types/classification";
import { group } from "../qualification-log";

import { ForwardingQualificationEngine } from "./forwarding.engine";

/**
 * Wraps any {@link QualificationEngine} and prints what it decided about each
 * field, on development builds only.
 *
 * This answers the question the boolean interface swallows: a field that gets
 * no inline menu looks identical to a field the engine never saw, because both
 * arrive at the consumer as `false`. The log distinguishes them — an unseen
 * field prints `(no classification)`, a seen-but-rejected one prints the roles
 * and contexts it did match, and the form contexts column shows whether the
 * field's *form* was the thing that failed to qualify.
 *
 * **Composition order matters.** Put this decorator *inside* the memoizing one:
 *
 * ```
 * new MemoizingQualificationEngine(new LoggingQualificationEngine(engine))
 * ```
 *
 * Memoizing on the outside means the log fires once per unique snapshot. The
 * other order logs on every cache hit, which on a page whose fields are each
 * queried by several predicates is dozens of identical dumps.
 *
 * Engines are not asked to log themselves. Doing it here means every engine in
 * the bay — including ones added later — is observable on the same terms, and
 * the comparison between two engines on one page is line-for-line.
 */
export class LoggingQualificationEngine extends ForwardingQualificationEngine {
  constructor(inner: QualificationEngine) {
    super(inner);
  }

  override classify(pageDetails: AutofillPageDetails): PageQualification {
    const result = this.inner.classify(pageDetails);
    group(this.headline(pageDetails, result), this.fieldLines(pageDetails, result));
    return result;
  }

  private headline(pageDetails: AutofillPageDetails, result: PageQualification): string {
    const formCount = Object.keys(pageDetails.forms ?? {}).length;
    const fieldCount = pageDetails.fields?.length ?? 0;
    const scenario = result.scenario() ?? "none";

    return (
      `${this.name} v${this.version} — ${pageDetails.documentUrl} ` +
      `(${fieldCount} fields, ${formCount} forms, scenario=${scenario})`
    );
  }

  private fieldLines(
    pageDetails: AutofillPageDetails,
    result: PageQualification,
  ): ReadonlyArray<string> {
    return (pageDetails.fields ?? []).map((field) => {
      const label = `${field.opid} ${describeField(field.type, field.htmlID, field.htmlName)}`;
      const classification = result.fieldFor(field.opid);

      if (classification === null) {
        // Not a failure on its own: the engine excludes hidden and submit
        // fields before scoring, so this is the expected line for those.
        return `${label} (no classification)`;
      }

      return `${label} ${describeClassification(classification)}`;
    });
  }
}

function describeField(
  type: string | undefined,
  htmlID: string | null | undefined,
  htmlName: string | null | undefined,
): string {
  const identity = htmlID || htmlName || "(unnamed)";
  return `[${type ?? "?"} ${identity}]`;
}

function describeClassification(classification: FieldClassification): string {
  const roles = setToList(classification.matchedRoles);
  const contexts = setToList(classification.matchedFormContexts);

  return (
    `role=${classification.topRole ?? "none"} ` +
    `confidence=${classification.confidence} ` +
    `score=${classification.score.toFixed(3)} ` +
    `roles=[${roles}] ` +
    `formContexts=[${contexts}]`
  );
}

function setToList(values: ReadonlySet<string>): string {
  return [...values].join(",");
}
