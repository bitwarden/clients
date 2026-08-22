import { AutofillTargetingRuleTypes } from "@bitwarden/common/autofill/constants";
import { AutofillTargetingRuleType, FormPurposeCategory } from "@bitwarden/common/autofill/types";

import { AutofillFieldQualifier, AutofillFieldQualifierType } from "../enums/autofill-field.enums";

import { FormKind } from "./types";
import { FieldRole } from "./types/field-role";

/**
 * Translations between {@link FieldRole} and the other role namespaces autofill
 * uses.
 *
 * Four namespaces name the same handful of concepts. `FieldRole` is the
 * qualification layer's; {@link AutofillFieldQualifier} is what a captured
 * user-filled field is tagged with, for the save/update notification;
 * {@link AutofillTargetingRuleTypes} is the webmapper rule vocabulary, which
 * follows the WHATWG autocomplete tokens; and {@link FormPurposeCategory} is the
 * rule vocabulary's form-level counterpart. Consumers that cross between them
 * used to do it with hand-written string comparisons at each site. These tables
 * are that crossing, once.
 *
 * Every map is total over its key type, so adding a member anywhere is a
 * compile error until someone decides what it corresponds to. `null` is a
 * decision — "this has no counterpart" — not a gap.
 *
 * Distinct from `vocabulary.ts`, which maps the engine's *internal* labels to
 * the shipped public ones. This file maps the shipped labels outward.
 */

/**
 * The qualifier a captured field is tagged with when the engine gives it this
 * role.
 *
 * Not injective and not total in the other direction, because
 * `AutofillFieldQualifier` is a smaller vocabulary:
 *
 * - `updateCurrentPassword` shares `password`. The distinction is which flow
 *   the field sits in, and a captured value doesn't carry the flow.
 * - `email` and `totp` map to nothing. The login-form qualifier map never had
 *   an email entry — a login email is captured as `username`, which is what
 *   `isUsernameField` already returns true for — and a one-time code is never
 *   saved to a cipher.
 * - `cardBrand` maps to nothing: it is fill-time only, with no boolean
 *   predicate and no qualifier. See `services/qualification/role-predicates.ts`.
 */
export const FIELD_QUALIFIER_BY_ROLE: Readonly<
  Record<FieldRole, AutofillFieldQualifierType | null>
> = Object.freeze({
  [FieldRole.Username]: AutofillFieldQualifier.username,
  [FieldRole.CurrentPassword]: AutofillFieldQualifier.password,
  [FieldRole.UpdateCurrentPassword]: AutofillFieldQualifier.password,
  [FieldRole.NewPassword]: AutofillFieldQualifier.newPassword,
  [FieldRole.Email]: null,
  [FieldRole.Totp]: null,
  [FieldRole.CardholderName]: AutofillFieldQualifier.cardholderName,
  [FieldRole.CardNumber]: AutofillFieldQualifier.cardNumber,
  [FieldRole.CardExpirationDate]: AutofillFieldQualifier.cardExpirationDate,
  [FieldRole.CardExpirationMonth]: AutofillFieldQualifier.cardExpirationMonth,
  [FieldRole.CardExpirationYear]: AutofillFieldQualifier.cardExpirationYear,
  [FieldRole.CardCvv]: AutofillFieldQualifier.cardCvv,
  [FieldRole.CardBrand]: null,
  [FieldRole.IdentityTitle]: AutofillFieldQualifier.identityTitle,
  [FieldRole.IdentityFirstName]: AutofillFieldQualifier.identityFirstName,
  [FieldRole.IdentityMiddleName]: AutofillFieldQualifier.identityMiddleName,
  [FieldRole.IdentityLastName]: AutofillFieldQualifier.identityLastName,
  [FieldRole.IdentityFullName]: AutofillFieldQualifier.identityFullName,
  [FieldRole.IdentityAddress1]: AutofillFieldQualifier.identityAddress1,
  [FieldRole.IdentityAddress2]: AutofillFieldQualifier.identityAddress2,
  [FieldRole.IdentityAddress3]: AutofillFieldQualifier.identityAddress3,
  [FieldRole.IdentityCity]: AutofillFieldQualifier.identityCity,
  [FieldRole.IdentityState]: AutofillFieldQualifier.identityState,
  [FieldRole.IdentityPostalCode]: AutofillFieldQualifier.identityPostalCode,
  [FieldRole.IdentityCountry]: AutofillFieldQualifier.identityCountry,
  [FieldRole.IdentityCompany]: AutofillFieldQualifier.identityCompany,
  [FieldRole.IdentityPhone]: AutofillFieldQualifier.identityPhone,
  [FieldRole.IdentityEmail]: AutofillFieldQualifier.identityEmail,
  [FieldRole.IdentityUsername]: AutofillFieldQualifier.identityUsername,
});

/**
 * The role a webmapper targeting rule declares a field to have.
 *
 * Read this direction only. A rule is an authored statement about a specific
 * page, and the engine treats it as certain evidence rather than re-deriving
 * it; nothing needs to go the other way.
 *
 * Two rule types collide with the credential roles on purpose. Bare `email` and
 * `username` mean the *credential*, not the profile field — the same call the
 * autocomplete engine makes for the equivalent attribute tokens, and for the
 * same reason (see `likelihood-ratios.ts`). A rule that means the profile field
 * on an identity form is indistinguishable at this layer.
 *
 * `null` is everything the qualification vocabulary has no role for: the
 * decomposed phone and birthdate parts, the deeper address levels, consent
 * checkboxes, and search. Autofill can target these; the engine cannot score
 * them, and pretending otherwise would put a heuristic where a rule already
 * gave a definite answer.
 */
export const ROLE_BY_TARGETING_RULE_TYPE: Readonly<
  Record<AutofillTargetingRuleType, FieldRole | null>
> = Object.freeze({
  [AutofillTargetingRuleTypes.username]: FieldRole.Username,
  [AutofillTargetingRuleTypes.password]: FieldRole.CurrentPassword,
  [AutofillTargetingRuleTypes.newPassword]: FieldRole.NewPassword,
  [AutofillTargetingRuleTypes.oneTimeCode]: FieldRole.Totp,

  [AutofillTargetingRuleTypes.fullName]: FieldRole.IdentityFullName,
  [AutofillTargetingRuleTypes.honorificPrefix]: FieldRole.IdentityTitle,
  [AutofillTargetingRuleTypes.firstName]: FieldRole.IdentityFirstName,
  [AutofillTargetingRuleTypes.middleName]: FieldRole.IdentityMiddleName,
  [AutofillTargetingRuleTypes.lastName]: FieldRole.IdentityLastName,
  [AutofillTargetingRuleTypes.honorificSuffix]: null,

  [AutofillTargetingRuleTypes.email]: FieldRole.Email,
  [AutofillTargetingRuleTypes.phone]: FieldRole.IdentityPhone,
  [AutofillTargetingRuleTypes.phoneCountryCode]: null,
  [AutofillTargetingRuleTypes.phoneAreaCode]: null,
  [AutofillTargetingRuleTypes.phoneLocal]: null,
  [AutofillTargetingRuleTypes.phoneExtension]: null,
  [AutofillTargetingRuleTypes.organization]: FieldRole.IdentityCompany,

  [AutofillTargetingRuleTypes.streetAddress]: FieldRole.IdentityAddress1,
  [AutofillTargetingRuleTypes.addressLine1]: FieldRole.IdentityAddress1,
  [AutofillTargetingRuleTypes.addressLine2]: FieldRole.IdentityAddress2,
  [AutofillTargetingRuleTypes.addressLine3]: FieldRole.IdentityAddress3,
  [AutofillTargetingRuleTypes.addressLevel1]: FieldRole.IdentityState,
  [AutofillTargetingRuleTypes.addressLevel2]: FieldRole.IdentityCity,
  [AutofillTargetingRuleTypes.addressLevel3]: null,
  [AutofillTargetingRuleTypes.addressLevel4]: null,
  [AutofillTargetingRuleTypes.postalCode]: FieldRole.IdentityPostalCode,
  [AutofillTargetingRuleTypes.country]: FieldRole.IdentityCountry,

  [AutofillTargetingRuleTypes.birthdate]: null,
  [AutofillTargetingRuleTypes.birthdateDay]: null,
  [AutofillTargetingRuleTypes.birthdateMonth]: null,
  [AutofillTargetingRuleTypes.birthdateYear]: null,

  [AutofillTargetingRuleTypes.cardholderName]: FieldRole.CardholderName,
  [AutofillTargetingRuleTypes.cardNumber]: FieldRole.CardNumber,
  [AutofillTargetingRuleTypes.cardExpirationDate]: FieldRole.CardExpirationDate,
  [AutofillTargetingRuleTypes.cardExpirationMonth]: FieldRole.CardExpirationMonth,
  [AutofillTargetingRuleTypes.cardExpirationYear]: FieldRole.CardExpirationYear,
  [AutofillTargetingRuleTypes.cardCvv]: FieldRole.CardCvv,
  [AutofillTargetingRuleTypes.cardType]: FieldRole.CardBrand,

  [AutofillTargetingRuleTypes.consentTerms]: null,
  [AutofillTargetingRuleTypes.consentPrivacy]: null,
  [AutofillTargetingRuleTypes.consentUser]: null,

  [AutofillTargetingRuleTypes.searchTerm]: null,
});

/**
 * The engine's form label for a rule-declared form purpose.
 *
 * Near-identity: the two vocabularies were already spelled the same, which is
 * why `FormKind` reads `"account-login"` rather than `"login"`. Writing it out
 * makes the correspondence checkable instead of coincidental.
 *
 * `address` and `search` have no `FormKind`. An address-only form scores as
 * `identity` through the engine's archetypes rather than getting a label of its
 * own, and a search form is something autofill declines rather than classifies.
 */
export const FORM_KIND_BY_PURPOSE_CATEGORY: Readonly<Record<FormPurposeCategory, FormKind | null>> =
  Object.freeze({
    "account-creation": FormKind.AccountCreation,
    "account-login": FormKind.AccountLogin,
    "account-recovery": FormKind.AccountRecovery,
    "account-update": FormKind.AccountUpdate,
    address: null,
    identity: FormKind.Identity,
    "payment-card": FormKind.PaymentCard,
    search: null,
    signup: FormKind.Signup,
  });
