import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { QualificationEngine } from "../../qualification/abstractions/qualification-engine";
import { FieldRole } from "../../qualification/types/field-role";
import { FormCategory } from "../../qualification/types/form-category";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";

import { CATEGORY_PREDICATES, ROLE_PREDICATES } from "./role-predicates";

/**
 * Implements the legacy 35-method {@link InlineMenuFieldQualificationService}
 * interface by delegating classification to a {@link QualificationEngine},
 * with fall-through to a held legacy service for roles and categories the
 * engine declares it doesn't cover.
 *
 * The adapter holds a reverse-lookup map from `AutofillField` to the
 * `AutofillPageDetails` snapshot that owns it, so field-only boolean methods
 * can resolve a field's classification without needing `pageDetails` passed
 * at each call site. Form-context boolean methods (`isFieldFor*Form`)
 * auto-enroll because they already receive `pageDetails`. Caching of
 * classification results is delegated to the engine — wrap the engine in
 * {@link MemoizingQualificationEngine} when one classify-per-snapshot is
 * desired.
 *
 * **Routing.** For each role-based or form-context predicate, the adapter
 * checks whether the engine declared coverage for that role/category. If
 * yes, the answer comes from `matchedRoles.has(...)` / `matchedFormContexts.has(...)`
 * against the engine's classification. If no, the call falls through to
 * the held legacy service via {@link ROLE_PREDICATES} / {@link CATEGORY_PREDICATES}.
 * An engine that omits `coveredRoles` / `coveredCategories` is treated as
 * covering everything (no fall-through).
 *
 * **Un-enrolled fields.** A field-only role query for a field whose page has
 * not been enrolled falls through to the legacy service rather than returning
 * `false`. A forgotten `enroll()` call surfaces as a legacy answer rather
 * than a silent regression to "not a username, not a password, not an email"
 * across every field on the page.
 *
 * Element-typed predicates (submit buttons) and the `hasCurrentPasswordAutocomplete`
 * attribute check are always delegated to the legacy service — the engine
 * port does not accept live DOM elements, and the autocomplete check is a
 * simple attribute test that does not benefit from running through an engine.
 *
 * All public methods are declared as arrow class fields so that
 * `AutofillOverlayContentService` (which extracts unbound method references
 * into qualifier maps and invokes them as bare functions) keeps working.
 */
export class QualificationEngineAdapter implements InlineMenuFieldQualificationService {
  private readonly fieldToPage = new WeakMap<AutofillField, AutofillPageDetails>();

  constructor(
    private readonly engine: QualificationEngine,
    private readonly legacy: InlineMenuFieldQualificationService,
  ) {}

  /**
   * Registers a freshly collected `AutofillPageDetails` snapshot with the
   * adapter. Subsequent field-only boolean queries that reference fields in
   * this snapshot will resolve through the engine. Re-enrolling the same
   * snapshot re-populates the reverse-lookup map idempotently.
   */
  enroll(pageDetails: AutofillPageDetails): void {
    for (const field of pageDetails.fields) {
      this.fieldToPage.set(field, pageDetails);
    }
  }

  private engineCoversRole(role: FieldRole): boolean {
    return this.engine.coveredRoles?.has(role) ?? true;
  }

  private engineCoversCategory(category: FormCategory): boolean {
    return this.engine.coveredCategories?.has(category) ?? true;
  }

  private fieldHasRole(field: AutofillField, role: FieldRole): boolean {
    if (!this.engineCoversRole(role)) {
      return ROLE_PREDICATES[role](this.legacy, field);
    }
    const pd = this.fieldToPage.get(field);
    if (!pd) {
      return ROLE_PREDICATES[role](this.legacy, field);
    }
    return this.engine.classify(pd).fieldFor(field.opid)?.matchedRoles.has(role) ?? false;
  }

  private fieldHasFormContext(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
    category: FormCategory,
  ): boolean {
    if (!this.engineCoversCategory(category)) {
      return CATEGORY_PREDICATES[category](this.legacy, field, pageDetails);
    }
    this.enroll(pageDetails);
    return (
      this.engine.classify(pageDetails).fieldFor(field.opid)?.matchedFormContexts.has(category) ??
      false
    );
  }

  isUsernameField = (field: AutofillField): boolean => this.fieldHasRole(field, FieldRole.Username);

  isCurrentPasswordField = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CurrentPassword);

  isUpdateCurrentPasswordField = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.UpdateCurrentPassword);

  isNewPasswordField = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.NewPassword);

  isEmailField = (field: AutofillField): boolean => this.fieldHasRole(field, FieldRole.Email);

  isTotpField = (field: AutofillField): boolean => this.fieldHasRole(field, FieldRole.Totp);

  isFieldForLoginForm = (field: AutofillField, pageDetails: AutofillPageDetails): boolean =>
    this.fieldHasFormContext(field, pageDetails, FormCategory.Login);

  isFieldForCreditCardForm = (field: AutofillField, pageDetails: AutofillPageDetails): boolean =>
    this.fieldHasFormContext(field, pageDetails, FormCategory.CreditCard);

  isFieldForAccountCreationForm = (
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean => this.fieldHasFormContext(field, pageDetails, FormCategory.AccountCreation);

  isFieldForIdentityForm = (field: AutofillField, pageDetails: AutofillPageDetails): boolean =>
    this.fieldHasFormContext(field, pageDetails, FormCategory.Identity);

  isFieldForCardholderName = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardholderName);

  isFieldForCardNumber = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardNumber);

  isFieldForCardExpirationDate = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardExpirationDate);

  isFieldForCardExpirationMonth = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardExpirationMonth);

  isFieldForCardExpirationYear = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardExpirationYear);

  isFieldForCardCvv = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.CardCvv);

  isFieldForIdentityTitle = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityTitle);

  isFieldForIdentityFirstName = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityFirstName);

  isFieldForIdentityMiddleName = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityMiddleName);

  isFieldForIdentityLastName = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityLastName);

  isFieldForIdentityFullName = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityFullName);

  isFieldForIdentityAddress1 = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityAddress1);

  isFieldForIdentityAddress2 = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityAddress2);

  isFieldForIdentityAddress3 = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityAddress3);

  isFieldForIdentityCity = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityCity);

  isFieldForIdentityState = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityState);

  isFieldForIdentityPostalCode = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityPostalCode);

  isFieldForIdentityCountry = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityCountry);

  isFieldForIdentityCompany = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityCompany);

  isFieldForIdentityPhone = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityPhone);

  isFieldForIdentityEmail = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityEmail);

  isFieldForIdentityUsername = (field: AutofillField): boolean =>
    this.fieldHasRole(field, FieldRole.IdentityUsername);

  isElementLoginSubmitButton = (element: Element): boolean =>
    this.legacy.isElementLoginSubmitButton(element);

  isElementChangePasswordSubmitButton = (element: Element): boolean =>
    this.legacy.isElementChangePasswordSubmitButton(element);

  hasCurrentPasswordAutocomplete = (field: AutofillField): boolean =>
    this.legacy.hasCurrentPasswordAutocomplete(field);
}
