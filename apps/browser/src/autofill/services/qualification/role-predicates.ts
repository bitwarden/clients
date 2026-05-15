import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { FieldRole } from "../../qualification/types/field-role";
import { FormCategory } from "../../qualification/types/form-category";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";

/**
 * Maps a `FieldRole` to the legacy boolean predicate that determines whether a field
 * fills that role. Used by both `LegacyBridgeEngine` (to populate `matchedRoles`)
 * and `QualificationEngineAdapter` (to fall through for roles the engine doesn't
 * cover). Single source of truth for the role/predicate correspondence.
 *
 * When a new `FieldRole` is added, extend this map and the adapter / bridge / any
 * engine declaring coverage all pick up the change automatically.
 */
export type FieldRolePredicate = (
  legacy: InlineMenuFieldQualificationService,
  field: AutofillField,
) => boolean;

export const ROLE_PREDICATES: Readonly<Record<FieldRole, FieldRolePredicate>> = Object.freeze({
  [FieldRole.Username]: (l, f) => l.isUsernameField(f),
  [FieldRole.CurrentPassword]: (l, f) => l.isCurrentPasswordField(f),
  [FieldRole.UpdateCurrentPassword]: (l, f) => l.isUpdateCurrentPasswordField(f),
  [FieldRole.NewPassword]: (l, f) => l.isNewPasswordField(f),
  [FieldRole.Email]: (l, f) => l.isEmailField(f),
  [FieldRole.Totp]: (l, f) => l.isTotpField(f),
  [FieldRole.CardholderName]: (l, f) => l.isFieldForCardholderName(f),
  [FieldRole.CardNumber]: (l, f) => l.isFieldForCardNumber(f),
  [FieldRole.CardExpirationDate]: (l, f) => l.isFieldForCardExpirationDate(f),
  [FieldRole.CardExpirationMonth]: (l, f) => l.isFieldForCardExpirationMonth(f),
  [FieldRole.CardExpirationYear]: (l, f) => l.isFieldForCardExpirationYear(f),
  [FieldRole.CardCvv]: (l, f) => l.isFieldForCardCvv(f),
  [FieldRole.IdentityTitle]: (l, f) => l.isFieldForIdentityTitle(f),
  [FieldRole.IdentityFirstName]: (l, f) => l.isFieldForIdentityFirstName(f),
  [FieldRole.IdentityMiddleName]: (l, f) => l.isFieldForIdentityMiddleName(f),
  [FieldRole.IdentityLastName]: (l, f) => l.isFieldForIdentityLastName(f),
  [FieldRole.IdentityFullName]: (l, f) => l.isFieldForIdentityFullName(f),
  [FieldRole.IdentityAddress1]: (l, f) => l.isFieldForIdentityAddress1(f),
  [FieldRole.IdentityAddress2]: (l, f) => l.isFieldForIdentityAddress2(f),
  [FieldRole.IdentityAddress3]: (l, f) => l.isFieldForIdentityAddress3(f),
  [FieldRole.IdentityCity]: (l, f) => l.isFieldForIdentityCity(f),
  [FieldRole.IdentityState]: (l, f) => l.isFieldForIdentityState(f),
  [FieldRole.IdentityPostalCode]: (l, f) => l.isFieldForIdentityPostalCode(f),
  [FieldRole.IdentityCountry]: (l, f) => l.isFieldForIdentityCountry(f),
  [FieldRole.IdentityCompany]: (l, f) => l.isFieldForIdentityCompany(f),
  [FieldRole.IdentityPhone]: (l, f) => l.isFieldForIdentityPhone(f),
  [FieldRole.IdentityEmail]: (l, f) => l.isFieldForIdentityEmail(f),
  [FieldRole.IdentityUsername]: (l, f) => l.isFieldForIdentityUsername(f),
});

/**
 * Maps a `FormCategory` to the legacy boolean predicate that determines whether a
 * field belongs to a form of that category. Same role as {@link ROLE_PREDICATES}.
 */
export type FormCategoryPredicate = (
  legacy: InlineMenuFieldQualificationService,
  field: AutofillField,
  pageDetails: AutofillPageDetails,
) => boolean;

export const CATEGORY_PREDICATES: Readonly<Record<FormCategory, FormCategoryPredicate>> =
  Object.freeze({
    [FormCategory.Login]: (l, f, pd) => l.isFieldForLoginForm(f, pd),
    [FormCategory.AccountCreation]: (l, f, pd) => l.isFieldForAccountCreationForm(f, pd),
    [FormCategory.CreditCard]: (l, f, pd) => l.isFieldForCreditCardForm(f, pd),
    [FormCategory.Identity]: (l, f, pd) => l.isFieldForIdentityForm(f, pd),
  });

export const ALL_FIELD_ROLES: ReadonlyArray<FieldRole> = Object.freeze(
  Object.keys(ROLE_PREDICATES) as FieldRole[],
);

export const ALL_FORM_CATEGORIES: ReadonlyArray<FormCategory> = Object.freeze(
  Object.keys(CATEGORY_PREDICATES) as FormCategory[],
);
