import AutofillPageDetails from "../models/autofill-page-details";

import { ARCHETYPES } from "./archetypes";
import { classifyFieldCluster } from "./classification";
import { clusterByForm, clusterFieldsBySplitForms } from "./clustering";
import { ClassifiedField, ClassifiedFormCluster, FieldCluster, FormClusterUnit } from "./internal";
import { buildPageQualification } from "./projection";
import { synthesizeScenario } from "./scenario";
import { buildFieldUnits } from "./signals";
import {
  ClassificationReason,
  FieldRole,
  FormCategory,
  FormKind,
  PageQualification,
  QualificationEngine,
  QualificationEngineId,
} from "./types";
import { SCORING_ENGINE_COVERED_CATEGORIES, SCORING_ENGINE_COVERED_ROLES } from "./vocabulary";

const FORM_KIND_EPSILON = 0.001;

// Score given to a form purpose a targeting rule declared. Above
// `isAboveFormMatchedFloor` and above the "certain" band, so a declared form
// lands in `matchedCategories` without depending on how the archetype weights
// happen to be tuned.
const DECLARED_FORM_SCORE = 2.0;

export class ScoringQualificationEngine implements QualificationEngine {
  readonly id = QualificationEngineId.Scoring;
  readonly name = "Scoring Qualification Engine";
  readonly version = "0.2.0";

  /**
   * FieldRoles this engine knows how to emit. Adapter consumers should route
   * role-based boolean predicates through the engine only for these roles;
   * roles outside this set must fall through to another qualification source
   * (typically the legacy service) to avoid silent regression.
   *
   * Derived from the engine's vocabulary mapping; grows automatically as new
   * archetypes and field kinds are added.
   *
   * **Premium and `Totp`.** This engine treats `Totp` as a regular role — its
   * structural classification is premium-agnostic. This matches the legacy
   * `isTotpField` predicate, which also doesn't gate on premium internally;
   * premium gating happens in the consumers that surface TOTP autofill (e.g.
   * inline-menu surfacing in `InlineMenuFieldQualificationService.qualifyField`,
   * fill-time code in `AutofillService.findTotpField`). Consumers reading the
   * engine's `matchedRoles.has(Totp)` should continue to apply that premium
   * gate themselves; the engine is not the right place for it.
   */
  readonly coveredRoles: ReadonlySet<FieldRole> = SCORING_ENGINE_COVERED_ROLES;

  /**
   * FormCategories this engine knows how to emit on `FormClassification.matchedCategories`.
   * Same routing principle as {@link coveredRoles}.
   */
  readonly coveredCategories: ReadonlySet<FormCategory> = SCORING_ENGINE_COVERED_CATEGORIES;

  classify(pageDetails: AutofillPageDetails): PageQualification {
    const units = buildFieldUnits(pageDetails);
    const fieldClusters = clusterFieldsBySplitForms(units);
    const classifiedFields = fieldClusters.map(classifyField);
    const formClusters = clusterByForm(classifiedFields);
    const classifiedForms = formClusters.map(classifyForm);
    const scenario = synthesizeScenario(classifiedForms);

    return buildPageQualification(classifiedFields, classifiedForms, scenario);
  }
}

function classifyField(cluster: FieldCluster): ClassifiedField {
  const { distribution, reasons } = classifyFieldCluster(cluster);
  return { cluster, distribution, reasons };
}

function classifyForm(cluster: FormClusterUnit): ClassifiedFormCluster {
  if (cluster.declaredKind !== null) {
    return declaredFormClassification(cluster, cluster.declaredKind);
  }

  const distribution: Partial<Record<FormKind, number>> = {};
  const reasons: ClassificationReason[] = [];
  for (const archetype of ARCHETYPES) {
    const scoreResult = archetype.score(cluster);
    reasons.push(...scoreResult.reasons);
    let adjusted: number;
    if (scoreResult.score === 0) {
      // Vetoed archetypes stay vetoed. A forbidden matcher firing collapses
      // the structural score to zero, and ambient evidence ("subscribe",
      // "checkout") must not revive it — a form with a password field is
      // not a newsletter signup no matter what the page title says.
      adjusted = 0;
    } else {
      const ambient = archetype.ambientPrior(cluster.ambient);
      reasons.push(...ambient.reasons);
      adjusted = Math.max(0, scoreResult.score + ambient.boost);
    }
    if (adjusted > FORM_KIND_EPSILON) {
      distribution[archetype.kind] = adjusted;
    }
  }
  // No "unknown" fallback: an empty distribution means "no archetype claimed
  // this form." `argmax` reports `kind: "unknown"` as the sentinel for that.
  return { cluster, distribution, reasons };
}

/**
 * The classification for a form a targeting rule already named.
 *
 * The field-level counterpart is `declaredClassification` in
 * `classification.ts`, and the reasoning is identical: a rule is authored, the
 * archetypes are inferred, and running the archetypes anyway could only agree
 * or be wrong. Skipping them also skips the ambient priors, so a rule saying
 * `payment-card` isn't second-guessed by a page title reading "Create account".
 */
function declaredFormClassification(
  cluster: FormClusterUnit,
  kind: FormKind,
): ClassifiedFormCluster {
  return {
    cluster,
    distribution: { [kind]: DECLARED_FORM_SCORE },
    reasons: [
      {
        type: "ambient-cue",
        contributedTo: kind,
        slot: "formAttrs",
        raw: "targeting-rule",
        matchedToken: "declared",
      },
    ],
  };
}

export function createScoringQualificationEngine(): QualificationEngine {
  return new ScoringQualificationEngine();
}
