import AutofillField from "../models/autofill-field";
import { fieldContainsKeyword } from "../utils/qualification";

import { argmax, bandFor } from "./classification";
import { ClassifiedField, ClassifiedFormCluster, FieldCluster } from "./internal";
import {
  CategoryScore,
  ClusterMembership,
  Distribution,
  FieldClassification,
  FieldRole,
  FormCategory,
  FormClassification,
  FormKind,
  PageQualification,
  PageScenario,
  RoleScore,
  ScoringEngineTrace,
} from "./types";
import { isAboveFormMatchedFloor, isAboveMatchedFloor, toFormCategory } from "./vocabulary";

type ParentFormContext = {
  readonly categories: ReadonlySet<FormCategory>;
  readonly internalKind: FormKind | "unknown";
};

const EMPTY_PARENT_CONTEXT: ParentFormContext = Object.freeze({
  categories: new Set<FormCategory>(),
  internalKind: "unknown",
});

/**
 * Field-level keywords that indicate a current-password field is part of a
 * change-password flow. Matched against the field's own attributes; mirrors
 * `AutofillConstants.UpdatePasswordFieldKeywords` so the engine and the
 * legacy `isUpdateCurrentPasswordField` predicate emit the role under the
 * same conditions.
 */
const UPDATE_PASSWORD_FIELD_KEYWORDS: ReadonlyArray<string> = [
  "update password",
  "change password",
  "current password",
  "kennwort ändern",
];

export function buildPageQualification(
  classifiedFields: ReadonlyArray<ClassifiedField>,
  classifiedForms: ReadonlyArray<ClassifiedFormCluster>,
  scenario: PageScenario | null,
): PageQualification {
  const formMap = new Map<string, FormClassification>();
  const parentContextByOpid = new Map<string, ParentFormContext>();
  for (const cfc of classifiedForms) {
    if (cfc.cluster.scope.kind !== "form-element") {
      continue;
    }
    const record = projectFormClassification(cfc);
    const internalKind = argmax(cfc.distribution).kind as FormKind | "unknown";
    for (const opid of cfc.cluster.scope.opids) {
      formMap.set(opid, record);
      parentContextByOpid.set(opid, {
        categories: record.matchedCategories,
        internalKind,
      });
    }
  }

  const fieldMap = new Map<string, FieldClassification>();
  for (const cf of classifiedFields) {
    const parentOpid = cf.cluster.members[0].source.form ?? null;
    const parentContext =
      (parentOpid !== null ? parentContextByOpid.get(parentOpid) : undefined) ??
      EMPTY_PARENT_CONTEXT;
    for (let i = 0; i < cf.cluster.members.length; i++) {
      const member = cf.cluster.members[i];
      fieldMap.set(member.source.opid, projectFieldClassification(cf, i, parentContext));
    }
  }

  return {
    fieldFor: (opid) => fieldMap.get(opid) ?? null,
    formFor: (opid) => formMap.get(opid) ?? null,
    scenario: () => scenario,
  };
}

function projectFieldClassification(
  classified: ClassifiedField,
  memberIndex: number,
  parentContext: ParentFormContext,
): FieldClassification {
  const { kind: argmaxKind, confidence: argmaxScore } = argmax(classified.distribution);
  const sourceField = classified.cluster.members[0].source;
  const matchedRoles = collectMatchedRoles(
    classified.distribution,
    sourceField,
    parentContext.internalKind,
  );
  const allScores = collectFieldScores(classified.distribution);
  const topRole = pickTopRole(argmaxKind, argmaxScore);

  return {
    matchedRoles,
    matchedFormContexts: parentContext.categories,
    topRole,
    confidence: bandFor(argmaxScore),
    score: argmaxScore,
    allScores,
    trace: buildFieldTrace(classified, memberIndex, argmaxKind),
  };
}

function collectMatchedRoles(
  distribution: Distribution<FieldRole>,
  sourceField: AutofillField,
  parentInternalKind: FormKind | "unknown",
): ReadonlySet<FieldRole> {
  const roles = new Set<FieldRole>();
  for (const [k, v] of Object.entries(distribution) as Array<[FieldRole, number]>) {
    if (typeof v === "number" && isAboveMatchedFloor(v)) {
      roles.add(k);
      // UpdateCurrentPassword: emit when EITHER signal source agrees.
      //   (a) Parent form's internal kind is account-update — engine's
      //       form-context discrimination, stronger than legacy.
      //   (b) Field's own attributes contain update-password keywords —
      //       legacy's signal source, kept so the engine never *misses*
      //       what legacy catches.
      // The OR makes the engine a strict superset of legacy on this role.
      if (
        k === FieldRole.CurrentPassword &&
        (parentInternalKind === "account-update" || fieldHasUpdatePasswordEvidence(sourceField))
      ) {
        roles.add(FieldRole.UpdateCurrentPassword);
      }
    }
  }
  return roles;
}

function fieldHasUpdatePasswordEvidence(field: AutofillField): boolean {
  return fieldContainsKeyword(field, UPDATE_PASSWORD_FIELD_KEYWORDS);
}

function collectFieldScores(distribution: Distribution<FieldRole>): ReadonlyArray<RoleScore> {
  const out: RoleScore[] = [];
  for (const [k, v] of Object.entries(distribution) as Array<[FieldRole, number]>) {
    if (typeof v !== "number") {
      continue;
    }
    out.push({ role: k, score: v });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function pickTopRole(argmaxKind: FieldRole | "unknown", argmaxScore: number): FieldRole | null {
  if (argmaxKind === "unknown") {
    return null;
  }
  if (!isAboveMatchedFloor(argmaxScore)) {
    return null;
  }
  return argmaxKind;
}

function buildFieldTrace(
  classified: ClassifiedField,
  memberIndex: number,
  internalKind: FieldRole | "unknown",
): ScoringEngineTrace {
  return {
    engine: "scoring",
    internalKind,
    cluster: membershipFor(classified.cluster, memberIndex),
    reasons: classified.reasons,
  };
}

function membershipFor(cluster: FieldCluster, index: number): ClusterMembership | undefined {
  if (cluster.shape === null) {
    return undefined;
  }
  if (cluster.shape.variant === "split-by-position") {
    return {
      id: cluster.id,
      shape: "split-by-position",
      position: index,
      total: cluster.shape.total,
    };
  }
  return {
    id: cluster.id,
    shape: "split-by-role",
    role: roleAt(cluster, index),
  };
}

function roleAt(cluster: FieldCluster, index: number): string | undefined {
  if (cluster.shape?.variant !== "split-by-role") {
    return undefined;
  }
  const opid = cluster.members[index].source.opid;
  const kind = cluster.shape.roles.get(opid);
  return kind ?? undefined;
}

function projectFormClassification(classified: ClassifiedFormCluster): FormClassification {
  const { kind: argmaxKind, confidence: argmaxScore } = argmax(classified.distribution);
  const matchedCategories = collectMatchedCategories(classified.distribution);
  const allScores = collectFormScores(classified.distribution);
  const topCategory = pickTopCategory(argmaxKind);
  const disqualified = isFullyVetoed(classified);

  return {
    matchedCategories,
    topCategory,
    confidence: disqualified ? "disqualified" : bandFor(argmaxScore),
    score: argmaxScore,
    allScores,
    trace: {
      engine: "scoring",
      internalKind: argmaxKind,
      reasons: classified.reasons,
    },
  };
}

function collectMatchedCategories(distribution: Distribution<FormKind>): ReadonlySet<FormCategory> {
  const categories = new Set<FormCategory>();
  for (const [k, v] of Object.entries(distribution) as Array<[FormKind, number]>) {
    if (typeof v !== "number" || !isAboveFormMatchedFloor(v)) {
      continue;
    }
    const category = toFormCategory(k);
    if (category !== null) {
      categories.add(category);
    }
  }
  return categories;
}

function collectFormScores(distribution: Distribution<FormKind>): ReadonlyArray<CategoryScore> {
  const out: CategoryScore[] = [];
  for (const [k, v] of Object.entries(distribution) as Array<[FormKind, number]>) {
    if (typeof v !== "number") {
      continue;
    }
    const category = toFormCategory(k);
    if (category !== null) {
      out.push({ category, score: v });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function pickTopCategory(argmaxKind: FormKind | "unknown"): FormCategory | null {
  if (argmaxKind === "unknown") {
    return null;
  }
  return toFormCategory(argmaxKind);
}

function isFullyVetoed(classified: ClassifiedFormCluster): boolean {
  // Refined `Distribution<FormKind>` never contains "unknown" and never holds
  // entries at or below epsilon (engine.ts filters at the boundary). Empty
  // distribution ≡ every archetype scored zero ≡ fully vetoed.
  return Object.keys(classified.distribution).length === 0;
}
