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
  Distribution,
  FieldRole,
  FormCategory,
  FormKind,
  PageQualification,
  QualificationEngine,
} from "./types";
import { SCORING_ENGINE_COVERED_CATEGORIES, SCORING_ENGINE_COVERED_ROLES } from "./vocabulary";

const FORM_KIND_EPSILON = 0.001;

export class ScoringQualificationEngine implements QualificationEngine {
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
  const scores: Partial<Record<FormKind | "unknown", number>> = {};
  const reasons: ClassificationReason[] = [];
  let maxScore = 0;
  for (const archetype of ARCHETYPES) {
    const scoreResult = archetype.score(cluster);
    reasons.push(...scoreResult.reasons);
    let adjusted: number;
    if (scoreResult.score === 0) {
      adjusted = 0;
    } else {
      const ambient = archetype.ambientPrior(cluster.ambient);
      reasons.push(...ambient.reasons);
      adjusted = Math.max(0, scoreResult.score + ambient.boost);
    }
    scores[archetype.kind] = adjusted;
    if (adjusted > maxScore) {
      maxScore = adjusted;
    }
  }
  scores.unknown = Math.max(0, 1 - maxScore);

  const distribution: Partial<Record<FormKind | "unknown", number>> = {};
  for (const [k, v] of Object.entries(scores) as Array<[FormKind | "unknown", number]>) {
    if (v > FORM_KIND_EPSILON) {
      distribution[k] = v;
    }
  }
  if (Object.keys(distribution).length === 0) {
    distribution.unknown = 1;
  }

  return { cluster, distribution: distribution as Distribution<FormKind>, reasons };
}

export function createScoringQualificationEngine(): QualificationEngine {
  return new ScoringQualificationEngine();
}
