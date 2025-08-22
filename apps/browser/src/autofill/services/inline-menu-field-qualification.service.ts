// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import { getSubmitButtonKeywordsSet, sendExtensionMessage } from "../utils";

import {
  AutofillKeywordsMap,
  InlineMenuFieldQualificationService as InlineMenuFieldQualificationServiceInterface,
  SubmitButtonKeywordsMap,
} from "./abstractions/inline-menu-field-qualifications.service";
import {
  AutoFillConstants,
  CreditCardAutoFillConstants,
  IdentityAutoFillConstants,
  SubmitChangePasswordButtonNames,
  SubmitLoginButtonNames,
} from "./autofill-constants";

export class InlineMenuFieldQualificationService
  implements InlineMenuFieldQualificationServiceInterface
{
  private searchFieldNamesSet = new Set(AutoFillConstants.SearchFieldNames);
  private excludedAutofillFieldTypesSet = new Set(AutoFillConstants.ExcludedAutofillLoginTypes);
  private usernameFieldTypes = new Set(["text", "email", "number", "tel"]);
  private usernameAutocompleteValue = "username";
  private emailAutocompleteValue = "email";
  private webAuthnAutocompleteValue = "webauthn";
  private loginUsernameAutocompleteValues = new Set([
    this.usernameAutocompleteValue,
    this.emailAutocompleteValue,
    this.webAuthnAutocompleteValue,
  ]);
  private fieldIgnoreListString = AutoFillConstants.FieldIgnoreList.join(",");
  private currentPasswordAutocompleteValue = "current-password";
  private newPasswordAutoCompleteValue = "new-password";
  private autofillFieldKeywordsMap: AutofillKeywordsMap = new WeakMap();
  private submitButtonKeywordsMap: SubmitButtonKeywordsMap = new WeakMap();
  private autocompleteDisabledValues = new Set(["off", "false"]);
  private accountCreationFieldKeywords = [
    "register",
    "registration",
    "create password",
    "create a password",
    "create an account",
    "create account password",
    "create user password",
    "confirm password",
    "confirm account password",
    "confirm user password",
    "new user",
    "new email",
    "new e-mail",
    "new password",
    "new-password",
    "neuer benutzer",
    "neues passwort",
    "neue e-mail",
    "pwdcheck",
  ];
  private newEmailFieldKeywords = new Set(AutoFillConstants.NewEmailFieldKeywords);
  private newsletterFormKeywords = new Set(AutoFillConstants.NewsletterFormNames);
  private updatePasswordFieldKeywords = [
    "update password",
    "change password",
    "current password",
    "kennwort ändern",
  ];
  private creditCardFieldKeywords = [
    ...new Set([
      ...CreditCardAutoFillConstants.CardHolderFieldNames,
      ...CreditCardAutoFillConstants.CardNumberFieldNames,
      ...CreditCardAutoFillConstants.CardExpiryFieldNames,
      ...CreditCardAutoFillConstants.ExpiryMonthFieldNames,
      ...CreditCardAutoFillConstants.ExpiryYearFieldNames,
      ...CreditCardAutoFillConstants.CVVFieldNames,
      ...CreditCardAutoFillConstants.CardBrandFieldNames,
    ]),
  ];
  private creditCardNameAutocompleteValues = new Set([
    "cc-name",
    "cc-given-name,",
    "cc-additional-name",
    "cc-family-name",
  ]);
  private creditCardExpirationDateAutocompleteValue = "cc-exp";
  private creditCardExpirationMonthAutocompleteValue = "cc-exp-month";
  private creditCardExpirationYearAutocompleteValue = "cc-exp-year";
  private creditCardCvvAutocompleteValue = "cc-csc";
  private creditCardNumberAutocompleteValue = "cc-number";
  private creditCardTypeAutocompleteValue = "cc-type";
  private creditCardAutocompleteValues = new Set([
    ...this.creditCardNameAutocompleteValues,
    this.creditCardExpirationDateAutocompleteValue,
    this.creditCardExpirationMonthAutocompleteValue,
    this.creditCardExpirationYearAutocompleteValue,
    this.creditCardNumberAutocompleteValue,
    this.creditCardCvvAutocompleteValue,
    this.creditCardTypeAutocompleteValue,
  ]);
  private identityHonorificPrefixAutocompleteValue = "honorific-prefix";
  private identityFullNameAutocompleteValue = "name";
  private identityFirstNameAutocompleteValue = "given-name";
  private identityMiddleNameAutocompleteValue = "additional-name";
  private identityLastNameAutocompleteValue = "family-name";
  private identityNameAutocompleteValues = new Set([
    this.identityFullNameAutocompleteValue,
    this.identityHonorificPrefixAutocompleteValue,
    this.identityFirstNameAutocompleteValue,
    this.identityMiddleNameAutocompleteValue,
    this.identityLastNameAutocompleteValue,
    "honorific-suffix",
    "nickname",
  ]);
  private identityCompanyAutocompleteValue = "organization";
  private identityStreetAddressAutocompleteValue = "street-address";
  private identityAddressLine1AutocompleteValue = "address-line1";
  private identityAddressLine2AutocompleteValue = "address-line2";
  private identityAddressLine3AutocompleteValue = "address-line3";
  private identityAddressCityAutocompleteValue = "address-level2";
  private identityAddressStateAutocompleteValue = "address-level1";
  private identityAddressAutoCompleteValues = new Set([
    this.identityStreetAddressAutocompleteValue,
    this.identityAddressLine1AutocompleteValue,
    this.identityAddressLine2AutocompleteValue,
    this.identityAddressLine3AutocompleteValue,
    this.identityAddressCityAutocompleteValue,
    this.identityAddressStateAutocompleteValue,
    "shipping",
    "billing",
    "address-level4",
    "address-level3",
  ]);
  private identityCountryAutocompleteValues = new Set(["country", "country-name"]);
  private identityPostalCodeAutocompleteValue = "postal-code";
  private identityPhoneAutocompleteValue = "tel";
  private identityPhoneNumberAutocompleteValues = new Set([
    this.identityPhoneAutocompleteValue,
    "tel-country-code",
    "tel-area-code",
    "tel-local",
    "tel-extension",
  ]);
  private identityAutocompleteValues = new Set([
    ...this.identityNameAutocompleteValues,
    ...this.loginUsernameAutocompleteValues,
    ...this.identityCompanyAutocompleteValue,
    ...this.identityAddressAutoCompleteValues,
    ...this.identityCountryAutocompleteValues,
    ...this.identityPhoneNumberAutocompleteValues,
    this.identityCompanyAutocompleteValue,
    this.identityPostalCodeAutocompleteValue,
  ]);
  private totpFieldAutocompleteValue = "one-time-code";
  private premiumEnabled = false;

  /**
   * Validates the provided field to indicate if the field is a new email field used for account creation/registration.
   *
   * @param field - The field to validate
   */
  private isExplicitIdentityEmailField(field: AutofillField): boolean {
    const matchFieldAttributeValues = [field.type, field.htmlName, field.htmlID, field.placeholder];
    for (let attrIndex = 0; attrIndex < matchFieldAttributeValues.length; attrIndex++) {
      if (!matchFieldAttributeValues[attrIndex]) {
        continue;
      }

      for (let keywordIndex = 0; keywordIndex < matchFieldAttributeValues.length; keywordIndex++) {
        if (this.newEmailFieldKeywords.has(matchFieldAttributeValues[attrIndex])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validates the provided form to indicate if the form is related to newsletter registration.
   *
   * @param parentForm - The form to validate
   */
  private isNewsletterForm(parentForm: any): boolean {
    if (!parentForm) {
      return false;
    }

    const matchFieldAttributeValues = [
      parentForm.type,
      parentForm.htmlName,
      parentForm.htmlID,
      parentForm.placeholder,
    ];

    for (let attrIndex = 0; attrIndex < matchFieldAttributeValues.length; attrIndex++) {
      const attrValue = matchFieldAttributeValues[attrIndex];
      if (!attrValue || typeof attrValue !== "string") {
        continue;
      }
      const attrValueLower = attrValue.toLowerCase();
      for (const keyword of this.newsletterFormKeywords) {
        if (attrValueLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  constructor() {
    void Promise.all([
      sendExtensionMessage("getInlineMenuFieldQualificationFeatureFlag"),
      sendExtensionMessage("getUserPremiumStatus"),
    ]).then(([fieldQualificationFlag, premiumStatus]) => {
      this.premiumEnabled = !!premiumStatus?.result;
    });
  }

  /**
   * Validates the provided field as a field for a login form.
   *
   * @param field - The field to validate, should be a username or password field.
   * @param pageDetails - The details of the page that the field is on.
   */
  isFieldForLoginForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean {
    /**
     * Totp inline menu is available only for premium users.
     */
    if (this.premiumEnabled) {
      const isTotpField = this.isTotpField(field);
      // Autofill does not fill totp inputs with a "password" `type` attribute value
      const passwordType = field.type === "password";
      if (isTotpField && !passwordType) {
        return true;
      }
    }

    const isCurrentPasswordField = this.isCurrentPasswordField(field);
    if (isCurrentPasswordField) {
      return this.isPasswordFieldForLoginForm(field, pageDetails);
    }

    const isUsernameField = this.isUsernameField(field);
    if (!isUsernameField) {
      return false;
    }

    return this.isUsernameFieldForLoginForm(field, pageDetails);
  }

  /**
   * Validates the provided field as a field for a credit card form.
   *
   * @param field - The field to validate
   * @param pageDetails - The details of the page that the field is on.
   */
  isFieldForCreditCardForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean {
    // If the field contains any of the standardized autocomplete attribute values
    // for credit card fields, we should assume that the field is part of a credit card form.
    if (this.fieldContainsAutocompleteValues(field, this.creditCardAutocompleteValues)) {
      return true;
    }

    const parentForm = pageDetails.forms[field.form];

    // If the field does not have a parent form
    if (!parentForm) {
      // If a credit card number field is not present on the page or there are multiple credit
      // card number fields, this field is not part of a credit card form.
      const numberFieldsInPageDetails = pageDetails.fields.filter(this.isFieldForCardNumber);
      if (numberFieldsInPageDetails.length !== 1) {
        return false;
      }

      // If a credit card CVV field is not present on the page or there are multiple credit card
      // CVV fields, this field is not part of a credit card form.
      const cvvFieldsInPageDetails = pageDetails.fields.filter(this.isFieldForCardCvv);
      if (cvvFieldsInPageDetails.length !== 1) {
        return false;
      }

      return this.keywordsFoundInFieldData(field, this.creditCardFieldKeywords);
    }

    // If the field has a parent form, check the fields from that form exclusively
    const fieldsFromSameForm = pageDetails.fields.filter((f) => f.form === field.form);

    // If a credit card number field is not present on the page or there are multiple credit
    // card number fields, this field is not part of a credit card form.
    const numberFieldsInPageDetails = fieldsFromSameForm.filter(this.isFieldForCardNumber);
    if (numberFieldsInPageDetails.length !== 1) {
      return false;
    }

    // If a credit card CVV field is not present on the page or there are multiple credit card
    // CVV fields, this field is not part of a credit card form.
    const cvvFieldsInPageDetails = fieldsFromSameForm.filter(this.isFieldForCardCvv);
    if (cvvFieldsInPageDetails.length !== 1) {
      return false;
    }

    return this.keywordsFoundInFieldData(field, [...this.creditCardFieldKeywords]);
  }

  /** Validates the provided field as a field for an account creation form.
   *
   * @param field - The field to validate
   * @param pageDetails - The details of the page that the field is on.
   */
  isFieldForAccountCreationForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean {
    if (
      this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet) ||
      this.isTotpField(field)
    ) {
      return false;
    }

    if (!this.isUsernameField(field) && !this.isPasswordField(field)) {
      return false;
    }

    const parentForm = pageDetails.forms[field.form];

    if (!parentForm) {
      // If the field does not have a parent form, but we can identify that the page contains at least
      // one new password field, we should assume that the field is part of an account creation form.
      const newPasswordFields = pageDetails.fields.filter(this.isNewPasswordField);
      if (newPasswordFields.length >= 1) {
        return true;
      }

      // If no password fields are found on the page, check for keywords that indicate the field is
      // part of an account creation form.
      return this.keywordsFoundInFieldData(field, this.accountCreationFieldKeywords);
    }

    // If the field has a parent form, check the fields from that form exclusively
    const fieldsFromSameForm = pageDetails.fields.filter((f) => f.form === field.form);
    const newPasswordFields = fieldsFromSameForm.filter(this.isNewPasswordField);
    if (newPasswordFields.length >= 1) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, this.accountCreationFieldKeywords);
  }

  /**
   * Validates the provided field as a field for an identity form.
   *
   * @param field - The field to validate
   * @param _pageDetails - Currently unused, will likely be required in the future
   */
  isFieldForIdentityForm(field: AutofillField, _pageDetails: AutofillPageDetails): boolean {
    if (this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet)) {
      return false;
    }

    return (
      // Recognize explicit identity email fields (like id="new-email")
      this.isFieldForIdentityEmail(field) ||
      this.fieldContainsAutocompleteValues(field, this.identityAutocompleteValues)
    );
  }

  /**
   * Validates the provided field as a password field for a login form.
   *
   * @param field - The field to validate
   * @param pageDetails - The details of the page that the field is on.
   */
  private isPasswordFieldForLoginForm(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean {
    const parentForm = pageDetails.forms[field.form];

    // If the provided field is set with an autocomplete value of "current-password", we should assume that
    // the page developer intends for this field to be interpreted as a password field for a login form.
    if (this.fieldContainsAutocompleteValues(field, this.currentPasswordAutocompleteValue)) {
      if (!parentForm) {
        return (
          pageDetails.fields.filter(this.isNewPasswordField).filter((f) => f.viewable).length === 0
        );
      }

      return (
        pageDetails.fields
          .filter(this.isNewPasswordField)
          .filter((f) => f.viewable && f.form === field.form).length === 0
      );
    }

    const usernameFieldsInPageDetails = pageDetails.fields.filter(this.isUsernameField);
    const passwordFieldsInPageDetails = pageDetails.fields.filter(this.isCurrentPasswordField);

    // If a single username and a single password field exists on the page, we
    // should assume that this field is part of a login form.
    if (usernameFieldsInPageDetails.length === 1 && passwordFieldsInPageDetails.length === 1) {
      return true;
    }

    // If the field is not structured within a form, we need to identify if the field is present on
    // a page with multiple password fields. If that isn't the case, we can assume this is a login form field.
    if (!parentForm) {
      // If no parent form is found, and multiple password fields are present, we should assume that
      // the passed field belongs to a user account creation form.
      if (passwordFieldsInPageDetails.length > 1) {
        return false;
      }

      // If multiple username fields exist on the page, we should assume that
      // the provided field is part of an account creation form.
      const visibleUsernameFields = usernameFieldsInPageDetails.filter((f) => f.viewable);
      if (visibleUsernameFields.length > 1) {
        return false;
      }

      // If a single username field or less is present on the page, then we can assume that the
      // provided field is for a login form. This will only be the case if the field does not
      // explicitly have its autocomplete attribute set to "off" or "false".

      return !this.fieldContainsAutocompleteValues(field, this.autocompleteDisabledValues);
    }

    // If the field has a form parent and there are multiple visible password fields
    // in the form, this is not a login form field
    const visiblePasswordFieldsInPageDetails = passwordFieldsInPageDetails.filter(
      (f) => f.form === field.form && f.viewable,
    );
    if (visiblePasswordFieldsInPageDetails.length > 1) {
      return false;
    }

    // If the form has any visible username fields, we should treat the field as part of a login form
    const visibleUsernameFields = usernameFieldsInPageDetails.filter(
      (f) => f.form === field.form && f.viewable,
    );
    if (visibleUsernameFields.length > 0) {
      return true;
    }

    // If the field has a form parent and no username field exists and the field has an
    // autocomplete attribute set to "off" or "false", this is not a password field
    return !this.fieldContainsAutocompleteValues(field, this.autocompleteDisabledValues);
  }

  /**
   * Validates the provided field as a username field for a login form.
   *
   * @param field - The field to validate
   * @param pageDetails - The details of the page that the field is on.
   */
  private isUsernameFieldForLoginForm(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean {
    // If the provided field is set with an autocomplete of "username", we should assume that
    // the page developer intends for this field to be interpreted as a username field.

    // Exclude non-login email field from being treated as a login username field
    if (this.isExplicitIdentityEmailField(field)) {
      return false;
    }

    if (this.fieldContainsAutocompleteValues(field, this.loginUsernameAutocompleteValues)) {
      const newPasswordFieldsInPageDetails = pageDetails.fields.filter(
        (field) => field.viewable && this.isNewPasswordField(field),
      );
      return newPasswordFieldsInPageDetails.length === 0;
    }

    // If any keywords in the field's data indicates that this is a field for a "new" or "changed"
    // username, we should assume that this field is not for a login form.
    if (this.keywordsFoundInFieldData(field, this.accountCreationFieldKeywords)) {
      return false;
    }

    // If the field is not explicitly set as a username field, we need to qualify
    // the field based on the other fields that are present on the page.
    const parentForm = pageDetails.forms[field.form];
    const passwordFieldsInPageDetails = pageDetails.fields.filter(this.isCurrentPasswordField);

    if (this.isNewsletterForm(parentForm)) {
      return false;
    }

    // If the field is not structured within a form, we need to identify if the field is used in conjunction
    // with a password field. If that's the case, then we should assume that it is a form field element.
    if (!parentForm) {
      // If a formless field is present in a webpage with a single password field, we
      // should assume that it is part of a login workflow.
      const visiblePasswordFieldsInPageDetails = passwordFieldsInPageDetails.filter(
        (passwordField) => passwordField.viewable,
      );
      if (visiblePasswordFieldsInPageDetails.length === 1) {
        return true;
      }

      // If more than a single password field exists on the page, we should assume that the field
      // is part of an account creation form.
      if (visiblePasswordFieldsInPageDetails.length > 1) {
        return false;
      }

      // If no visible fields are found on the page, but we have a single password
      // field we should assume that the field is part of a login form.
      if (passwordFieldsInPageDetails.length === 1) {
        return true;
      }

      // If the page does not contain any password fields, it might be part of a multistep login form.
      // That will only be the case if the field does not explicitly have its autocomplete attribute
      // set to "off" or "false".
      return !this.fieldContainsAutocompleteValues(field, this.autocompleteDisabledValues);
    }

    // If the field is structured within a form, but no password fields are present in the form,
    // we need to consider whether the field is part of a multistep login form.
    if (passwordFieldsInPageDetails.length === 0) {
      // If the field's autocomplete is set to a disabled value, we should assume that the field is
      // not part of a login form.
      if (this.fieldContainsAutocompleteValues(field, this.autocompleteDisabledValues)) {
        return false;
      }

      // If the form that contains a single field, we should assume that it is part
      // of a multistep login form.
      const fieldsWithinForm = pageDetails.fields.filter(
        (pageDetailsField) => pageDetailsField.form === field.form,
      );
      if (fieldsWithinForm.length === 1) {
        return true;
      }

      // If multiple fields exist within the form, we should check if a single visible field exists.
      // If so, we should assume that the field is part of a login form.
      return fieldsWithinForm.filter((field) => field.viewable).length === 1;
    }

    // If a single password field exists within the page details, and that password field is part of
    // the same form as the provided field, we should assume that the field is part of a login form.
    const visiblePasswordFieldsInPageDetails = passwordFieldsInPageDetails.filter(
      (passwordField) => passwordField.form === field.form && passwordField.viewable,
    );
    if (visiblePasswordFieldsInPageDetails.length === 1) {
      return true;
    }

    // If multiple visible password fields exist within the page details, we need to assume that the
    // provided field is part of an account creation form.
    if (visiblePasswordFieldsInPageDetails.length > 1) {
      return false;
    }

    // If we have a single password field we should assume that the field is part of a login form.
    if (passwordFieldsInPageDetails.length === 1) {
      return true;
    }

    // If no visible password fields are found, this field might be part of a multipart form.
    // Check for an invalid autocompleteType to determine if the field is part of a login form.
    return !this.fieldContainsAutocompleteValues(field, this.autocompleteDisabledValues);
  }

  /**
   * Validates the provided field as a credit card name field.
   *
   * @param field - The field to validate
   */
  isFieldForCardholderName = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.creditCardNameAutocompleteValues)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      CreditCardAutoFillConstants.CardHolderFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a credit card number field.
   *
   * @param field - The field to validate
   */
  isFieldForCardNumber = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.creditCardNumberAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      CreditCardAutoFillConstants.CardNumberFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a credit card expiration date field.
   *
   * @param field - The field to validate
   */
  isFieldForCardExpirationDate = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(field, this.creditCardExpirationDateAutocompleteValue)
    ) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      CreditCardAutoFillConstants.CardExpiryFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a credit card expiration month field.
   *
   * @param field - The field to validate
   */
  isFieldForCardExpirationMonth = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(field, this.creditCardExpirationMonthAutocompleteValue)
    ) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      CreditCardAutoFillConstants.ExpiryMonthFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a credit card expiration year field.
   *
   * @param field - The field to validate
   */
  isFieldForCardExpirationYear = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(field, this.creditCardExpirationYearAutocompleteValue)
    ) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      CreditCardAutoFillConstants.ExpiryYearFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a credit card CVV field.
   *
   * @param field - The field to validate
   */
  isFieldForCardCvv = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.creditCardCvvAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, CreditCardAutoFillConstants.CVVFieldNames, false);
  };

  /**
   * Validates the provided field as an identity title type field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityTitle = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(field, this.identityHonorificPrefixAutocompleteValue)
    ) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.TitleFieldNames, false);
  };

  /**
   * Validates the provided field as an identity full name field.
   *
   * @param field
   */
  isFieldForIdentityFirstName = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityFirstNameAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.FirstnameFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity middle name field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityMiddleName = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityMiddleNameAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.MiddlenameFieldNames,
      false,
    );
  };

  /**
   *  Validates the provided field as an identity last name field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityLastName = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityLastNameAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.LastnameFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity full name field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityFullName = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityFullNameAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.FullNameFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity address field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityAddress1 = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityAddressLine1AutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      [
        ...IdentityAutoFillConstants.AddressFieldNames,
        ...IdentityAutoFillConstants.Address1FieldNames,
      ],
      false,
    );
  };

  /**
   * Validates the provided field as an identity address field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityAddress2 = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityAddressLine2AutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.Address2FieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity address field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityAddress3 = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityAddressLine3AutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.Address3FieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity city field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityCity = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityAddressCityAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.CityFieldNames, false);
  };

  /**
   * Validates the provided field as an identity state field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityState = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityAddressStateAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.StateFieldNames, false);
  };

  /**
   * Validates the provided field as an identity postal code field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityPostalCode = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityPostalCodeAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.PostalCodeFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as an identity country field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityCountry = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityCountryAutocompleteValues)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.CountryFieldNames, false);
  };

  /**
   * Validates the provided field as an identity company field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityCompany = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityCompanyAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.CompanyFieldNames, false);
  };

  /**
   * Validates the provided field as an identity phone field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityPhone = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.identityPhoneAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.PhoneFieldNames, false);
  };

  /**
   * Validates the provided field as an identity email field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityEmail = (field: AutofillField): boolean => {
    if (this.isExplicitIdentityEmailField(field)) {
      return true;
    }

    if (
      this.fieldContainsAutocompleteValues(field, this.emailAutocompleteValue) ||
      field.type === "email" ||
      field.htmlName === "email"
    ) {
      return true;
    }

    return this.keywordsFoundInFieldData(field, IdentityAutoFillConstants.EmailFieldNames, false);
  };

  /**
   * Validates the provided field as an identity username field.
   *
   * @param field - The field to validate
   */
  isFieldForIdentityUsername = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.usernameAutocompleteValue)) {
      return true;
    }

    return this.keywordsFoundInFieldData(
      field,
      IdentityAutoFillConstants.UserNameFieldNames,
      false,
    );
  };

  /**
   * Validates the provided field as a username field.
   *
   * @param field - The field to validate
   */
  isUsernameField = (field: AutofillField): boolean => {
    if (
      !this.usernameFieldTypes.has(field.type) ||
      this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet) ||
      this.fieldHasDisqualifyingAttributeValue(field)
    ) {
      return false;
    }

    return this.keywordsFoundInFieldData(field, AutoFillConstants.UsernameFieldNames);
  };

  /**
   * Validates the provided field as an email field.
   *
   * @param field - The field to validate
   */
  isEmailField = (field: AutofillField): boolean => {
    if (field.type === "email") {
      return true;
    }

    return (
      !this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet) &&
      this.keywordsFoundInFieldData(field, AutoFillConstants.EmailFieldNames)
    );
  };

  /**
   * Validates the provided field as a current password field.
   *
   * @param field - The field to validate
   */
  isCurrentPasswordField = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(field, this.newPasswordAutoCompleteValue) ||
      this.keywordsFoundInFieldData(field, this.accountCreationFieldKeywords)
    ) {
      return false;
    }

    return this.isPasswordField(field);
  };

  /**
   * Validates the provided field as a current password field for an update password form.
   *
   * @param field - The field to validate
   */
  isUpdateCurrentPasswordField = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.newPasswordAutoCompleteValue)) {
      return false;
    }

    return (
      this.isPasswordField(field) &&
      this.keywordsFoundInFieldData(field, this.updatePasswordFieldKeywords)
    );
  };

  /**
   * Validates the provided field as a new password field.
   *
   * @param field - The field to validate
   */
  isNewPasswordField = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.currentPasswordAutocompleteValue)) {
      return false;
    }

    return (
      this.isPasswordField(field) &&
      this.keywordsFoundInFieldData(field, this.accountCreationFieldKeywords)
    );
  };

  /**
   * Validates the provided field as a password field.
   *
   * @param field - The field to validate
   */
  private isPasswordField = (field: AutofillField): boolean => {
    const isInputPasswordType = field.type === "password";
    if (
      (!isInputPasswordType &&
        this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet)) ||
      this.fieldHasDisqualifyingAttributeValue(field) ||
      this.isTotpField(field)
    ) {
      return false;
    }

    return isInputPasswordType || this.isLikePasswordField(field);
  };

  /**
   * Validates the provided field as a field to indicate if the
   * field potentially acts as a password field.
   *
   * @param field - The field to validate
   */
  private isLikePasswordField(field: AutofillField): boolean {
    if (field.type !== "text") {
      return false;
    }

    const testedValues = [field.htmlID, field.htmlName, field.placeholder];
    for (let i = 0; i < testedValues.length; i++) {
      if (this.valueIsLikePassword(testedValues[i])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates the provided value to indicate if the value is like a password.
   *
   * @param value - The value to validate
   */
  private valueIsLikePassword(value: string): boolean {
    if (value == null) {
      return false;
    }
    // Removes all whitespace, _ and - characters
    const cleanedValue = value.toLowerCase().replace(/[\s_-]/g, "");

    if (cleanedValue.indexOf("password") < 0) {
      return false;
    }

    return !AutoFillConstants.PasswordFieldExcludeList.some((i) => cleanedValue.indexOf(i) > -1);
  }

  /**
   * Validates whether the provided field is a TOTP field.
   *
   * @param field - The field to validate
   */
  isTotpField = (field: AutofillField): boolean => {
    if (this.fieldContainsAutocompleteValues(field, this.totpFieldAutocompleteValue)) {
      return true;
    }

    return (
      !this.isExcludedFieldType(field, this.excludedAutofillFieldTypesSet) &&
      this.keywordsFoundInFieldData(field, AutoFillConstants.TotpFieldNames)
    );
  };

  /**
   * Validates the provided field to indicate if the field has a
   * disqualifying attribute that would impede autofill entirely.
   *
   * @param field - The field to validate
   */
  private fieldHasDisqualifyingAttributeValue(field: AutofillField): boolean {
    const checkedAttributeValues = [field.htmlID, field.htmlName, field.placeholder];

    for (let i = 0; i < checkedAttributeValues.length; i++) {
      const checkedAttributeValue = checkedAttributeValues[i];
      const cleanedValue = checkedAttributeValue?.toLowerCase().replace(/[\s_-]/g, "");

      if (cleanedValue && this.fieldIgnoreListString.indexOf(cleanedValue) > -1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates the provided field to indicate if the field is excluded from autofill.
   *
   * @param field - The field to validate
   * @param excludedTypes - The set of excluded types
   */
  private isExcludedFieldType(field: AutofillField, excludedTypes: Set<string>): boolean {
    if (excludedTypes.has(field.type)) {
      return true;
    }

    return this.isSearchField(field);
  }

  /**
   * Validates the provided field to indicate if the field is a search field.
   *
   * @param field - The field to validate
   */
  private isSearchField(field: AutofillField): boolean {
    const matchFieldAttributeValues = [field.type, field.htmlName, field.htmlID, field.placeholder];
    for (let attrIndex = 0; attrIndex < matchFieldAttributeValues.length; attrIndex++) {
      if (!matchFieldAttributeValues[attrIndex]) {
        continue;
      }

      // Separate camel case words and case them to lower case values
      const camelCaseSeparatedFieldAttribute = matchFieldAttributeValues[attrIndex]
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase();
      // Split the attribute by non-alphabetical characters to get the keywords
      const attributeKeywords = camelCaseSeparatedFieldAttribute.split(/[^a-z]/gi);

      for (let keywordIndex = 0; keywordIndex < attributeKeywords.length; keywordIndex++) {
        if (this.searchFieldNamesSet.has(attributeKeywords[keywordIndex])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validates the provided field to indicate if the field is a submit button for a login form.
   *
   * @param element - The element to validate
   */
  isElementLoginSubmitButton = (element: HTMLElement): boolean => {
    const keywordValues = this.getSubmitButtonKeywords(element);
    return SubmitLoginButtonNames.some((keyword) => keywordValues.indexOf(keyword) > -1);
  };

  /**
   * Validates the provided field to indicate if the field is a submit button for a change password form.
   *
   * @param element - The element to validate
   */
  isElementChangePasswordSubmitButton = (element: HTMLElement): boolean => {
    const keywordValues = this.getSubmitButtonKeywords(element);
    return SubmitChangePasswordButtonNames.some((keyword) => keywordValues.indexOf(keyword) > -1);
  };

  /**
   * Gather the keywords from the provided element to validate the submit button.
   *
   * @param element - The element to validate
   */
  private getSubmitButtonKeywords(element: HTMLElement): string {
    if (!this.submitButtonKeywordsMap.has(element)) {
      const keywordsSet = getSubmitButtonKeywordsSet(element);
      this.submitButtonKeywordsMap.set(element, Array.from(keywordsSet).join(","));
    }

    return this.submitButtonKeywordsMap.get(element);
  }

  /**
   * Validates the provided field to indicate if the field has any of the provided keywords.
   *
   * @param autofillFieldData - The field data to search for keywords
   * @param keywords - The keywords to search for
   * @param fuzzyMatchKeywords - Indicates if the keywords should be matched in a fuzzy manner
   */
  private keywordsFoundInFieldData(
    autofillFieldData: AutofillField,
    keywords: string[],
    fuzzyMatchKeywords = true,
  ) {
    const searchedValues = this.getAutofillFieldDataKeywords(autofillFieldData, fuzzyMatchKeywords);
    const parsedKeywords = keywords.map((keyword) => keyword.replace(/-/g, ""));

    if (typeof searchedValues === "string") {
      return parsedKeywords.some((keyword) => searchedValues.indexOf(keyword) > -1);
    }

    return parsedKeywords.some((keyword) => searchedValues.has(keyword));
  }

  /**
   * Retrieves the keywords from the provided autofill field data.
   *
   * @param autofillFieldData - The field data to search for keywords
   * @param returnStringValue - Indicates if the method should return a string value
   */
  private getAutofillFieldDataKeywords(
    autofillFieldData: AutofillField,
    returnStringValue: boolean,
  ) {
    if (!this.autofillFieldKeywordsMap.has(autofillFieldData)) {
      const keywords = [
        autofillFieldData.htmlID,
        autofillFieldData.htmlName,
        autofillFieldData.htmlClass,
        autofillFieldData.type,
        autofillFieldData.title,
        autofillFieldData.placeholder,
        autofillFieldData.autoCompleteType,
        autofillFieldData.dataSetValues,
        autofillFieldData["label-data"],
        autofillFieldData["label-aria"],
        autofillFieldData["label-left"],
        autofillFieldData["label-right"],
        autofillFieldData["label-tag"],
        autofillFieldData["label-top"],
      ];
      const keywordsSet = new Set<string>();
      for (let i = 0; i < keywords.length; i++) {
        if (keywords[i] && typeof keywords[i] === "string") {
          let keywordEl = keywords[i].toLowerCase();
          keywordsSet.add(keywordEl);

          // Remove hyphens from all potential keywords, we want to treat these as a single word.
          keywordEl = keywordEl.replace(/-/g, "");

          // Split the keyword by non-alphanumeric characters to get the keywords without treating a space as a separator.
          keywordEl.split(/[^\p{L}\d]+/gu).forEach((keyword: string) => {
            if (keyword) {
              keywordsSet.add(keyword);
            }
          });

          // Collapse all spaces and split by non-alphanumeric characters to get the keywords
          keywordEl
            .replace(/\s/g, "")
            .split(/[^\p{L}\d]+/gu)
            .forEach((keyword: string) => {
              if (keyword) {
                keywordsSet.add(keyword);
              }
            });
        }
      }

      const stringValue = Array.from(keywordsSet).join(",");
      this.autofillFieldKeywordsMap.set(autofillFieldData, { keywordsSet, stringValue });
    }

    const mapValues = this.autofillFieldKeywordsMap.get(autofillFieldData);
    return returnStringValue ? mapValues.stringValue : mapValues.keywordsSet;
  }

  /**
   * Separates the provided field data into space-separated values and checks if any
   * of the values are present in the provided set of autocomplete values.
   *
   * @param autofillFieldData - The field autocomplete value to validate
   * @param compareValues - The set of autocomplete values to check against
   */
  private fieldContainsAutocompleteValues(
    autofillFieldData: AutofillField,
    compareValues: string | Set<string>,
  ) {
    const fieldAutocompleteValue = autofillFieldData.autoCompleteType;
    if (!fieldAutocompleteValue || typeof fieldAutocompleteValue !== "string") {
      return false;
    }

    const autocompleteValueParts = fieldAutocompleteValue.split(" ");
    if (typeof compareValues === "string") {
      return autocompleteValueParts.indexOf(compareValues) > -1;
    }

    for (let index = 0; index < autocompleteValueParts.length; index++) {
      if (compareValues.has(autocompleteValueParts[index])) {
        return true;
      }
    }

    return false;
  }
}
