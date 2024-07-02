import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import { sendExtensionMessage } from "../utils";

import { InlineMenuFieldQualificationService as InlineMenuFieldQualificationServiceInterface } from "./abstractions/inline-menu-field-qualifications.service";
import { AutoFillConstants } from "./autofill-constants";

export class InlineMenuFieldQualificationService
  implements InlineMenuFieldQualificationServiceInterface
{
  private searchFieldNamesSet = new Set(AutoFillConstants.SearchFieldNames);
  private excludedAutofillLoginTypesSet = new Set(AutoFillConstants.ExcludedAutofillLoginTypes);
  private usernameFieldTypes = new Set(["text", "email", "number", "tel"]);
  private usernameAutocompleteValues = new Set(["username", "email"]);
  private fieldIgnoreListString = AutoFillConstants.FieldIgnoreList.join(",");
  private passwordFieldExcludeListString = AutoFillConstants.PasswordFieldExcludeList.join(",");
  private currentPasswordAutocompleteValues = new Set(["current-password"]);
  private newPasswordAutoCompleteValues = new Set(["new-password"]);
  private autofillFieldKeywordsMap: WeakMap<AutofillField, string> = new WeakMap();
  private autocompleteDisabledValues = new Set(["off", "false"]);
  private newFieldKeywords = new Set(["new", "change", "neue", "ändern"]);
  private accountCreationFieldKeywords = new Set([
    "register",
    "registration",
    "create",
    "confirm",
    ...this.newFieldKeywords,
  ]);
  private inlineMenuFieldQualificationFlagSet = false;

  constructor() {
    void sendExtensionMessage("getInlineMenuFieldQualificationFeatureFlag").then(
      (getInlineMenuFieldQualificationFlag) =>
        (this.inlineMenuFieldQualificationFlagSet = !!getInlineMenuFieldQualificationFlag?.result),
    );
  }

  /**
   * Validates the provided field as a field for a login form.
   *
   * @param field - The field to validate, should be a username or password field.
   * @param pageDetails - The details of the page that the field is on.
   */
  isFieldForLoginForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean {
    if (!this.inlineMenuFieldQualificationFlagSet) {
      return this.isFieldForLoginFormFallback(field);
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
   * Validates the provided field as a password field for a login form.
   *
   * @param field - The field to validate
   * @param pageDetails - The details of the page that the field is on.
   */
  private isPasswordFieldForLoginForm(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): boolean {
    // If the provided field is set with an autocomplete value of "current-password", we should assume that
    // the page developer intends for this field to be interpreted as a password field for a login form.
    if (
      this.fieldContainsAutocompleteValues(
        field.autoCompleteType,
        this.currentPasswordAutocompleteValues,
      )
    ) {
      return true;
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
    const parentForm = pageDetails.forms[field.form];
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

      return !this.fieldContainsAutocompleteValues(
        field.autoCompleteType,
        this.autocompleteDisabledValues,
      );
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
    return !this.fieldContainsAutocompleteValues(
      field.autoCompleteType,
      this.autocompleteDisabledValues,
    );
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
    if (
      this.fieldContainsAutocompleteValues(field.autoCompleteType, this.usernameAutocompleteValues)
    ) {
      const newPasswordFieldsInPageDetails = pageDetails.fields.filter(this.isNewPasswordField);
      return newPasswordFieldsInPageDetails.length === 0;
    }

    // If any keywords in the field's data indicates that this is a field for a "new" or "changed"
    // username, we should assume that this field is not for a login form.
    if (this.keywordsFoundInFieldData(field, [...this.newFieldKeywords])) {
      return false;
    }

    // If the field is not explicitly set as a username field, we need to qualify
    // the field based on the other fields that are present on the page.
    const parentForm = pageDetails.forms[field.form];
    const passwordFieldsInPageDetails = pageDetails.fields.filter(this.isCurrentPasswordField);

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
      return !this.fieldContainsAutocompleteValues(
        field.autoCompleteType,
        this.autocompleteDisabledValues,
      );
    }

    // If the field is structured within a form, but no password fields are present in the form,
    // we need to consider whether the field is part of a multistep login form.
    if (passwordFieldsInPageDetails.length === 0) {
      // If the field's autocomplete is set to a disabled value, we should assume that the field is
      // not part of a login form.
      if (
        this.fieldContainsAutocompleteValues(
          field.autoCompleteType,
          this.autocompleteDisabledValues,
        )
      ) {
        return false;
      }

      // If the form that contains the field has more than one visible field, we should assume
      // that the field is part of an account creation form.
      const fieldsWithinForm = pageDetails.fields.filter(
        (pageDetailsField) => pageDetailsField.form === field.form && pageDetailsField.viewable,
      );
      return fieldsWithinForm.length === 1;
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

    // If no visible password fields are found, this field might be part of a multipart form.
    // Check for an invalid autocompleteType to determine if the field is part of a login form.
    return !this.fieldContainsAutocompleteValues(
      field.autoCompleteType,
      this.autocompleteDisabledValues,
    );
  }

  /**
   * Validates the provided field as a username field.
   *
   * @param field - The field to validate
   */
  private isUsernameField = (field: AutofillField): boolean => {
    if (
      !this.usernameFieldTypes.has(field.type) ||
      this.isExcludedFieldType(field, this.excludedAutofillLoginTypesSet)
    ) {
      return false;
    }

    return this.keywordsFoundInFieldData(field, AutoFillConstants.UsernameFieldNames);
  };

  /**
   * Validates the provided field as a current password field.
   *
   * @param field - The field to validate
   */
  private isCurrentPasswordField = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(
        field.autoCompleteType,
        this.newPasswordAutoCompleteValues,
      ) ||
      this.keywordsFoundInFieldData(field, [...this.accountCreationFieldKeywords])
    ) {
      return false;
    }

    return this.isPasswordField(field);
  };

  /**
   * Validates the provided field as a new password field.
   *
   * @param field - The field to validate
   */
  private isNewPasswordField = (field: AutofillField): boolean => {
    if (
      this.fieldContainsAutocompleteValues(
        field.autoCompleteType,
        this.currentPasswordAutocompleteValues,
      )
    ) {
      return false;
    }

    return (
      this.isPasswordField(field) &&
      this.keywordsFoundInFieldData(field, [...this.accountCreationFieldKeywords])
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
        this.isExcludedFieldType(field, this.excludedAutofillLoginTypesSet)) ||
      this.fieldHasDisqualifyingAttributeValue(field)
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

    return !(this.passwordFieldExcludeListString.indexOf(cleanedValue) > -1);
  }

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
   * Validates the provided field to indicate if the field has any of the provided keywords.
   *
   * @param autofillFieldData - The field data to search for keywords
   * @param keywords - The keywords to search for
   */
  private keywordsFoundInFieldData(autofillFieldData: AutofillField, keywords: string[]) {
    const searchedString = this.getAutofillFieldDataKeywords(autofillFieldData);
    return keywords.some((keyword) => searchedString.includes(keyword));
  }

  /**
   * Retrieves the keywords from the provided autofill field data.
   *
   * @param autofillFieldData - The field data to search for keywords
   */
  private getAutofillFieldDataKeywords(autofillFieldData: AutofillField) {
    if (this.autofillFieldKeywordsMap.has(autofillFieldData)) {
      return this.autofillFieldKeywordsMap.get(autofillFieldData);
    }

    const keywordValues = [
      autofillFieldData.htmlID,
      autofillFieldData.htmlName,
      autofillFieldData.htmlClass,
      autofillFieldData.type,
      autofillFieldData.title,
      autofillFieldData.placeholder,
      autofillFieldData.autoCompleteType,
      autofillFieldData["label-data"],
      autofillFieldData["label-aria"],
      autofillFieldData["label-left"],
      autofillFieldData["label-right"],
      autofillFieldData["label-tag"],
      autofillFieldData["label-top"],
    ]
      .join(",")
      .toLowerCase();
    this.autofillFieldKeywordsMap.set(autofillFieldData, keywordValues);

    return keywordValues;
  }

  /**
   * Separates the provided field data into space-separated values and checks if any
   * of the values are present in the provided set of autocomplete values.
   *
   * @param fieldAutocompleteValue - The field autocomplete value to validate
   * @param compareValues - The set of autocomplete values to check against
   */
  private fieldContainsAutocompleteValues(
    fieldAutocompleteValue: string,
    compareValues: Set<string>,
  ) {
    if (!fieldAutocompleteValue) {
      return false;
    }

    const autocompleteValueParts = fieldAutocompleteValue.split(" ");
    for (let index = 0; index < autocompleteValueParts.length; index++) {
      if (compareValues.has(autocompleteValueParts[index])) {
        return true;
      }
    }

    return false;
  }

  /**
   * This method represents the previous rudimentary approach to qualifying fields for login forms.
   *
   * @param field - The field to validate
   * @deprecated - This method will only be used when the fallback flag is set to true.
   */
  private isFieldForLoginFormFallback(field: AutofillField): boolean {
    if (field.type === "password") {
      return true;
    }

    return this.isUsernameField(field);
  }
}
