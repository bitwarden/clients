import AutofillField from "../../../models/autofill-field";
import AutofillForm from "../../../models/autofill-form";
import AutofillPageDetails from "../../../models/autofill-page-details";
import { InlineMenuFieldQualificationService } from "../../abstractions/inline-menu-field-qualifications.service";
import { PageQualification, QualificationEngine } from "../abstractions/qualification-engine";
import {
  CategoryScore,
  FieldClassification,
  FormClassification,
  RoleScore,
} from "../types/classification";
import { FieldRole } from "../types/field-role";
import { FormCategory } from "../types/form-category";

const emptyRoleScores: ReadonlyArray<RoleScore> = Object.freeze([]);
const emptyCategoryScores: ReadonlyArray<CategoryScore> = Object.freeze([]);

/**
 * Bridges the legacy {@link InlineMenuFieldQualificationService} boolean
 * methods into a {@link QualificationEngine}. Each field's matched roles
 * are computed by calling every legacy predicate; each form's matched
 * categories are computed by checking every form-level predicate against
 * every field in the form.
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

    if (this.legacy.isUsernameField(field)) {matched.add(FieldRole.Username);}
    if (this.legacy.isCurrentPasswordField(field)) {matched.add(FieldRole.CurrentPassword);}
    if (this.legacy.isUpdateCurrentPasswordField(field)) {
      matched.add(FieldRole.UpdateCurrentPassword);
    }
    if (this.legacy.isNewPasswordField(field)) {matched.add(FieldRole.NewPassword);}
    if (this.legacy.isEmailField(field)) {matched.add(FieldRole.Email);}
    if (this.legacy.isTotpField(field)) {matched.add(FieldRole.Totp);}

    if (this.legacy.isFieldForCardholderName(field)) {matched.add(FieldRole.CardholderName);}
    if (this.legacy.isFieldForCardNumber(field)) {matched.add(FieldRole.CardNumber);}
    if (this.legacy.isFieldForCardExpirationDate(field)) {
      matched.add(FieldRole.CardExpirationDate);
    }
    if (this.legacy.isFieldForCardExpirationMonth(field)) {
      matched.add(FieldRole.CardExpirationMonth);
    }
    if (this.legacy.isFieldForCardExpirationYear(field)) {
      matched.add(FieldRole.CardExpirationYear);
    }
    if (this.legacy.isFieldForCardCvv(field)) {matched.add(FieldRole.CardCvv);}

    if (this.legacy.isFieldForIdentityTitle(field)) {matched.add(FieldRole.IdentityTitle);}
    if (this.legacy.isFieldForIdentityFirstName(field)) {matched.add(FieldRole.IdentityFirstName);}
    if (this.legacy.isFieldForIdentityMiddleName(field)) {
      matched.add(FieldRole.IdentityMiddleName);
    }
    if (this.legacy.isFieldForIdentityLastName(field)) {matched.add(FieldRole.IdentityLastName);}
    if (this.legacy.isFieldForIdentityFullName(field)) {matched.add(FieldRole.IdentityFullName);}
    if (this.legacy.isFieldForIdentityAddress1(field)) {matched.add(FieldRole.IdentityAddress1);}
    if (this.legacy.isFieldForIdentityAddress2(field)) {matched.add(FieldRole.IdentityAddress2);}
    if (this.legacy.isFieldForIdentityAddress3(field)) {matched.add(FieldRole.IdentityAddress3);}
    if (this.legacy.isFieldForIdentityCity(field)) {matched.add(FieldRole.IdentityCity);}
    if (this.legacy.isFieldForIdentityState(field)) {matched.add(FieldRole.IdentityState);}
    if (this.legacy.isFieldForIdentityPostalCode(field)) {
      matched.add(FieldRole.IdentityPostalCode);
    }
    if (this.legacy.isFieldForIdentityCountry(field)) {matched.add(FieldRole.IdentityCountry);}
    if (this.legacy.isFieldForIdentityCompany(field)) {matched.add(FieldRole.IdentityCompany);}
    if (this.legacy.isFieldForIdentityPhone(field)) {matched.add(FieldRole.IdentityPhone);}
    if (this.legacy.isFieldForIdentityEmail(field)) {matched.add(FieldRole.IdentityEmail);}
    if (this.legacy.isFieldForIdentityUsername(field)) {matched.add(FieldRole.IdentityUsername);}

    if (this.legacy.isFieldForLoginForm(field, pageDetails)) {
      matchedFormContexts.add(FormCategory.Login);
    }
    if (this.legacy.isFieldForAccountCreationForm(field, pageDetails)) {
      matchedFormContexts.add(FormCategory.AccountCreation);
    }
    if (this.legacy.isFieldForCreditCardForm(field, pageDetails)) {
      matchedFormContexts.add(FormCategory.CreditCard);
    }
    if (this.legacy.isFieldForIdentityForm(field, pageDetails)) {
      matchedFormContexts.add(FormCategory.Identity);
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
      if (this.legacy.isFieldForLoginForm(field, pageDetails)) {matched.add(FormCategory.Login);}
      if (this.legacy.isFieldForAccountCreationForm(field, pageDetails)) {
        matched.add(FormCategory.AccountCreation);
      }
      if (this.legacy.isFieldForCreditCardForm(field, pageDetails)) {
        matched.add(FormCategory.CreditCard);
      }
      if (this.legacy.isFieldForIdentityForm(field, pageDetails)) {
        matched.add(FormCategory.Identity);
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
