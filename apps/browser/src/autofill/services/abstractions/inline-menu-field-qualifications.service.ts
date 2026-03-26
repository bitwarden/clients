import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";

export type AutofillKeywordsMap = WeakMap<
  AutofillField,
  {
    keywordsSet: Set<string>;
    stringValue: string;
  }
>;

export type SubmitButtonKeywordsMap = WeakMap<HTMLElement, string>;

export interface InlineMenuFieldQualificationService {
  isUsernameField(field: AutofillField): boolean;
  isCurrentPasswordField(field: AutofillField): boolean;
  isUpdateCurrentPasswordField(field: AutofillField): boolean;
  isNewPasswordField(field: AutofillField): boolean;
  isEmailField(field: AutofillField): boolean;
  isFieldForLoginForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  isFieldForCreditCardForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  isFieldForAccountCreationForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  isFieldForIdentityForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
  isFieldForCardholderName(field: AutofillField): boolean;
  isFieldForCardNumber(field: AutofillField): boolean;
  isFieldForCardExpirationDate(field: AutofillField): boolean;
  isFieldForCardExpirationMonth(field: AutofillField): boolean;
  isFieldForCardExpirationYear(field: AutofillField): boolean;
  isFieldForCardCvv(field: AutofillField): boolean;
  isFieldForIdentityTitle(field: AutofillField): boolean;
  isFieldForIdentityFirstName(field: AutofillField): boolean;
  isFieldForIdentityMiddleName(field: AutofillField): boolean;
  isFieldForIdentityLastName(field: AutofillField): boolean;
  isFieldForIdentityFullName(field: AutofillField): boolean;
  isFieldForIdentityAddress1(field: AutofillField): boolean;
  isFieldForIdentityAddress2(field: AutofillField): boolean;
  isFieldForIdentityAddress3(field: AutofillField): boolean;
  isFieldForIdentityCity(field: AutofillField): boolean;
  isFieldForIdentityState(field: AutofillField): boolean;
  isFieldForIdentityPostalCode(field: AutofillField): boolean;
  isFieldForIdentityCountry(field: AutofillField): boolean;
  isFieldForIdentityCompany(field: AutofillField): boolean;
  isFieldForIdentityPhone(field: AutofillField): boolean;
  isFieldForIdentityEmail(field: AutofillField): boolean;
  isFieldForIdentityUsername(field: AutofillField): boolean;
  isElementLoginSubmitButton(element: Element): boolean;
  isElementChangePasswordSubmitButton(element: Element): boolean;
  isTotpField(field: AutofillField): boolean;

  // Helper methods exposed for enhanced triage reporting
  isPasswordField(field: AutofillField): boolean;
  isLikePasswordField(field: AutofillField): boolean;
  isSearchField(field: AutofillField): boolean;
  fieldHasDisqualifyingAttributeValue(field: AutofillField): boolean;
  isExcludedFieldType(field: AutofillField, excludedTypes: Set<string>): boolean;
  keywordsFoundInFieldData(
    autofillFieldData: AutofillField,
    keywords: string[],
    fuzzyMatchKeywords?: boolean,
  ): boolean;
  fieldContainsAutocompleteValues(
    autofillFieldData: AutofillField,
    compareValues: string | Set<string>,
  ): boolean;
}
