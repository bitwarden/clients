import AutofillField from "../../../models/autofill-field";
import AutofillForm from "../../../models/autofill-form";
import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import {
  CategoryScore,
  FieldClassification,
  FormClassification,
  RoleScore,
} from "../../../qualification/types/classification";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";
import { InlineMenuFieldQualificationService } from "../../abstractions/inline-menu-field-qualifications.service";
import {
  ALL_FIELD_ROLES,
  ALL_FORM_CATEGORIES,
  CATEGORY_PREDICATES,
  ROLE_PREDICATES,
} from "../role-predicates";

const emptyRoleScores: ReadonlyArray<RoleScore> = Object.freeze([]);
const emptyCategoryScores: ReadonlyArray<CategoryScore> = Object.freeze([]);

/**
 * Bridges the legacy {@link InlineMenuFieldQualificationService} boolean
 * methods into a {@link QualificationEngine}. Each field's matched roles
 * are computed by calling every legacy predicate from {@link ROLE_PREDICATES};
 * each form's matched categories are computed by checking every form-level
 * predicate from {@link CATEGORY_PREDICATES} against every field in the form.
 *
 * Confidence is always "high" when a predicate matches and "none" when
 * nothing matches — no scoring, no mutual-exclusion dispatch. This engine
 * exists to validate the adapter machinery with behavior-identical results
 * to the legacy service.
 *
 * **Performance caveat — benchmark before activation.**
 * This converts the legacy service's on-demand qualification model into an
 * eager whole-page pass: every role predicate runs against every field, and
 * every form-context predicate runs against every field in every form. On a
 * 40-field, 3-form checkout page this is ~1500 underlying boolean calls per
 * `classify()`. The {@link MemoizingQualificationEngine} dedupes across
 * consumers within a single pageDetails snapshot, but each new snapshot
 * triggers a fresh pass — and mutation-driven pageDetails collection can
 * fire frequently. Benchmark against representative pages before flipping
 * `FeatureFlag.AutofillQualificationEngine` to true in any consumer that
 * processes high-mutation surfaces.
 */
export class LegacyBridgeEngine implements QualificationEngine {
  constructor(private readonly legacy: InlineMenuFieldQualificationService) {}

  classify(pageDetails: AutofillPageDetails): PageQualification {
    const fieldClassifications = new Map<string, FieldClassification>();
    const formClassifications = new Map<string, FormClassification>();

    for (const field of pageDetails.fields) {
      fieldClassifications.set(field.opid, this.classifyField(field, pageDetails));
    }

    for (const form of Object.values(pageDetails.forms)) {
      formClassifications.set(form.opid, this.classifyForm(form, pageDetails));
    }

    return {
      fieldFor: (opid) => fieldClassifications.get(opid) ?? null,
      formFor: (opid) => formClassifications.get(opid) ?? null,
      scenario: () => null,
    };
  }

  private classifyField(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): FieldClassification {
    const matched = new Set<FieldRole>();
    const matchedFormContexts = new Set<FormCategory>();

    for (const role of ALL_FIELD_ROLES) {
      if (ROLE_PREDICATES[role](this.legacy, field)) {
        matched.add(role);
      }
    }

    for (const category of ALL_FORM_CATEGORIES) {
      if (CATEGORY_PREDICATES[category](this.legacy, field, pageDetails)) {
        matchedFormContexts.add(category);
      }
    }

    const [topRole = null] = matched;

    return {
      matchedRoles: matched,
      matchedFormContexts,
      topRole,
      confidence: matched.size > 0 ? "high" : "none",
      score: matched.size > 0 ? 100 : 0,
      allScores: emptyRoleScores,
    };
  }

  private classifyForm(form: AutofillForm, pageDetails: AutofillPageDetails): FormClassification {
    const matched = new Set<FormCategory>();
    const fieldsInForm = pageDetails.fields.filter((f) => f.form === form.opid);

    for (const field of fieldsInForm) {
      for (const category of ALL_FORM_CATEGORIES) {
        if (CATEGORY_PREDICATES[category](this.legacy, field, pageDetails)) {
          matched.add(category);
        }
      }
    }

    const [topCategory = null] = matched;

    return {
      matchedCategories: matched,
      topCategory,
      confidence: matched.size > 0 ? "high" : "none",
      score: matched.size > 0 ? 100 : 0,
      allScores: emptyCategoryScores,
    };
  }
}
