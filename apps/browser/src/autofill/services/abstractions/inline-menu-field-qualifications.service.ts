import { AutofillFieldQualifierType } from "../../enums/autofill-field.enums";
import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";

export type SubmitButtonKeywordsMap = WeakMap<HTMLElement, string>;

/**
 * An abstract class rather than an interface so it can serve as an Angular
 * injection token. The popup is provided either the legacy concrete service or
 * a {@link QualificationEngineAdapter}, depending on the selected engine, so
 * consumers must depend on this and never on the concrete class.
 */
export abstract class InlineMenuFieldQualificationService {
  abstract isUsernameField(field: AutofillField): boolean;
  abstract isCurrentPasswordField(field: AutofillField): boolean;
  abstract isUpdateCurrentPasswordField(field: AutofillField): boolean;
  abstract isNewPasswordField(field: AutofillField): boolean;
  abstract isEmailField(field: AutofillField): boolean;
  abstract isFieldForLoginForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  abstract isFieldForCreditCardForm(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean;
  abstract isFieldForAccountCreationForm(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean;
  abstract isFieldForIdentityForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  abstract isFieldForSshKeyForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  abstract isFieldForCardholderName(field: AutofillField): boolean;
  abstract isFieldForCardNumber(field: AutofillField): boolean;
  abstract isFieldForCardExpirationDate(field: AutofillField): boolean;
  abstract isFieldForCardExpirationMonth(field: AutofillField): boolean;
  abstract isFieldForCardExpirationYear(field: AutofillField): boolean;
  abstract isFieldForCardCvv(field: AutofillField): boolean;
  abstract isFieldForIdentityTitle(field: AutofillField): boolean;
  abstract isFieldForIdentityFirstName(field: AutofillField): boolean;
  abstract isFieldForIdentityMiddleName(field: AutofillField): boolean;
  abstract isFieldForIdentityLastName(field: AutofillField): boolean;
  abstract isFieldForIdentityFullName(field: AutofillField): boolean;
  abstract isFieldForIdentityAddress1(field: AutofillField): boolean;
  abstract isFieldForIdentityAddress2(field: AutofillField): boolean;
  abstract isFieldForIdentityAddress3(field: AutofillField): boolean;
  abstract isFieldForIdentityCity(field: AutofillField): boolean;
  abstract isFieldForIdentityState(field: AutofillField): boolean;
  abstract isFieldForIdentityPostalCode(field: AutofillField): boolean;
  abstract isFieldForIdentityCountry(field: AutofillField): boolean;
  abstract isFieldForIdentityCompany(field: AutofillField): boolean;
  abstract isFieldForIdentityPhone(field: AutofillField): boolean;
  abstract isFieldForIdentityEmail(field: AutofillField): boolean;
  abstract isFieldForIdentityUsername(field: AutofillField): boolean;
  abstract isElementLoginSubmitButton(element: Element): boolean;
  abstract isElementChangePasswordSubmitButton(element: Element): boolean;
  abstract isTotpField(field: AutofillField): boolean;
  abstract hasCurrentPasswordAutocomplete(field: AutofillField): boolean;
  // The two hooks below are declared as optional properties rather than
  // `abstract` members: `abstract foo?()` says both "you must implement this"
  // and "you needn't", and consumers already call them with `?.`. A property
  // says only the true half.

  /**
   * Optional hook for engine-backed implementations. Receives a freshly
   * collected {@link AutofillPageDetails} snapshot so the implementation can
   * classify its fields and forms in advance. The legacy concrete service
   * does not implement this — only adapter-backed implementations do.
   *
   * Consumers that collect pageDetails snapshots should call this with
   * optional chaining: `service.enroll?.(pageDetails)`.
   */
  enroll?: (pageDetails: AutofillPageDetails) => void;
  /**
   * Optional hook for engine-backed implementations. Returns the qualifier the
   * engine's chosen role maps to, or `null` when it has no answer for this
   * field — the field was never enrolled, the engine scored nothing, or the
   * role has no qualifier of its own.
   *
   * Exists because deriving a qualifier from the boolean predicates means
   * running them in some order and taking the first `true`, which makes the
   * answer depend on map iteration order rather than on which role fits best.
   * An engine already picked a winner; this asks for it.
   *
   * Consumers must handle `null` by falling back to their existing predicate
   * pass — the legacy concrete service does not implement this at all.
   */
  topQualifierFor?: (field: AutofillField) => AutofillFieldQualifierType | null;
}
