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
 * engine declaring coverage all pick up the change automatically. The map is total
 * over `FieldRole`, so forgetting is a compile error rather than a lookup miss.
 *
 * **`null` means the role has no legacy counterpart.** Roles the engine can emit
 * but the boolean interface never exposed — `cardBrand` is the first — belong to
 * fill-time only. There is nothing to fall through to, so callers treat a `null`
 * entry as "this role cannot be answered from the legacy service" rather than
 * calling a lambda that always returns false. {@link LEGACY_ANSWERABLE_ROLES} excludes
 * them, which keeps the bridge and the parity report from asserting against a
 * predicate that doesn't exist.
 */
export type FieldRolePredicate = (
  legacy: InlineMenuFieldQualificationService,
  field: AutofillField,
) => boolean;

export const ROLE_PREDICATES: Readonly<Record<FieldRole, FieldRolePredicate | null>> =
  Object.freeze({
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
    [FieldRole.CardBrand]: null,
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

/**
 * The legacy service's answer for a role, or `false` when the role has no legacy
 * counterpart.
 *
 * Every fall-through goes through here rather than indexing {@link ROLE_PREDICATES}
 * directly. The workspace compiles without `strictNullChecks`, so a `null` entry
 * indexed and called is a runtime `TypeError` the type-checker won't catch —
 * this is the one place that has to remember.
 */
export function legacyRoleAnswer(
  legacy: InlineMenuFieldQualificationService,
  field: AutofillField,
  role: FieldRole,
): boolean {
  return ROLE_PREDICATES[role]?.(legacy, field) ?? false;
}

/** Every role the legacy service can answer for. See {@link ROLE_PREDICATES}. */
export const LEGACY_ANSWERABLE_ROLES: ReadonlyArray<FieldRole> = Object.freeze(
  (Object.keys(ROLE_PREDICATES) as FieldRole[]).filter((role) => ROLE_PREDICATES[role] !== null),
);

export const ALL_FORM_CATEGORIES: ReadonlyArray<FormCategory> = Object.freeze(
  Object.keys(CATEGORY_PREDICATES) as FormCategory[],
);
