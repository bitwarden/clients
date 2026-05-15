import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";

import { PageQualification, QualificationEngine } from "./abstractions/qualification-engine";
import { FieldRole } from "./types/field-role";
import { FormCategory } from "./types/form-category";

/**
 * Implements the legacy 35-method {@link InlineMenuFieldQualificationService}
 * interface by delegating classification to a {@link QualificationEngine}.
 *
 * The adapter caches engine results by `AutofillPageDetails` reference and
 * maintains reverse lookups so the field-only boolean methods can resolve a
 * field's classification without needing `pageDetails` passed at each call
 * site. Form-context boolean methods (`isFieldFor*Form`) auto-enroll because
 * they already receive `pageDetails`.
 *
 * Element-typed predicates (submit buttons) and the `hasCurrentPasswordAutocomplete`
 * attribute check are delegated to a held legacy service instance — the engine
 * port does not accept live DOM elements, and the autocomplete check is a
 * simple attribute test that does not benefit from running through an engine.
 *
 * All public methods are declared as arrow class fields so that
 * `AutofillOverlayContentService` (which extracts unbound method references
 * into qualifier maps and invokes them as bare functions) keeps working.
 */
export class QualificationEngineAdapter implements InlineMenuFieldQualificationService {
  private readonly pageQualifications = new WeakMap<AutofillPageDetails, PageQualification>();
  private readonly fieldToPage = new WeakMap<AutofillField, AutofillPageDetails>();

  constructor(
    private readonly engine: QualificationEngine,
    private readonly legacy: InlineMenuFieldQualificationService,
  ) {}

  /**
   * Registers a freshly collected `AutofillPageDetails` snapshot with the
   * adapter. Subsequent field-only boolean queries that reference fields in
   * this snapshot will resolve through the engine. Calling enroll more than
   * once for the same snapshot is a no-op.
   */
  enroll(pageDetails: AutofillPageDetails): void {
    if (this.pageQualifications.has(pageDetails)) {
      return;
    }
    this.pageQualifications.set(pageDetails, this.engine.classify(pageDetails));
    for (const field of pageDetails.fields) {
      this.fieldToPage.set(field, pageDetails);
    }
  }

  private fieldHasRole(field: AutofillField, role: FieldRole): boolean {
    const pd = this.fieldToPage.get(field);
    if (!pd) {return false;}
    return this.pageQualifications.get(pd)?.fieldFor(field.opid)?.matchedRoles.has(role) ?? false;
  }

  private fieldHasFormContext(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
    category: FormCategory,
  ): boolean {
    this.enroll(pageDetails);
    return (
      this.pageQualifications
        .get(pageDetails)
        ?.fieldFor(field.opid)
        ?.matchedFormContexts.has(category) ?? false
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
