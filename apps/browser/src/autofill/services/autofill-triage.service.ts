import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import {
  AutofillTriageConditionResult,
  AutofillTriageFieldResult,
  AutofillTriageFormContext,
  TriageQualification,
} from "../types/autofill-triage";

import { AutofillTriageService as AutofillTriageServiceInterface } from "./abstractions/autofill-triage.service";
import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";

const VALUE_PREVIEW_MAX_LENGTH = 50;
const SENSITIVE_AUTOCOMPLETE_TYPES = [
  "cc-number",
  "cc-csc",
  "cc-exp",
  "ssn",
  "tax-id",
  "current-password",
  "new-password",
  "one-time-code",
];

export class AutofillTriageService implements AutofillTriageServiceInterface {
  constructor(private qualificationService: InlineMenuFieldQualificationService) {}

  /**
   * Analyzes a field by calling all relevant qualification methods and recording
   * their results as condition entries.
   *
   * @param field - The field to analyze
   * @param pageDetails - The page context
   * @returns Complete triage result with all checks performed
   */
  triageField(field: AutofillField, pageDetails: AutofillPageDetails): AutofillTriageFieldResult {
    const conditions: AutofillTriageConditionResult[] = [];

    // Field State & Visibility Checks
    conditions.push({
      description: "Field is viewable",
      passed: field.viewable !== false,
    });
    conditions.push({
      description: "Field is not readonly",
      passed: !field.readonly,
    });
    conditions.push({
      description: "Field is not disabled",
      passed: !field.disabled,
    });
    conditions.push({
      description: "Field is not ARIA-hidden",
      passed: !field["aria-hidden"],
    });
    conditions.push({
      description: "Field is not ARIA-disabled",
      passed: !field["aria-disabled"],
    });

    // Field Identity & Labeling Checks
    if (field.tagName) {
      conditions.push({
        description: `Has tagName: ${field.tagName}`,
        passed: true,
      });
    }
    if (field["label-left"]) {
      conditions.push({
        description: `Has label-left: "${this.truncateText(field["label-left"], 50)}"`,
        passed: true,
      });
    }
    if (field["label-right"]) {
      conditions.push({
        description: `Has label-right: "${this.truncateText(field["label-right"], 50)}"`,
        passed: true,
      });
    }
    if (field["label-tag"]) {
      conditions.push({
        description: `Has label-tag: "${this.truncateText(field["label-tag"], 50)}"`,
        passed: true,
      });
    }
    if (field["label-top"]) {
      conditions.push({
        description: `Has label-top: "${this.truncateText(field["label-top"], 50)}"`,
        passed: true,
      });
    }
    if (field.title) {
      conditions.push({
        description: `Has title: "${this.truncateText(field.title, 50)}"`,
        passed: true,
      });
    }
    if (field.htmlClass) {
      conditions.push({
        description: `Has htmlClass: "${this.truncateText(field.htmlClass, 50)}"`,
        passed: true,
      });
    }

    // Field Configuration Checks
    if (field.maxLength !== null && field.maxLength !== undefined) {
      conditions.push({
        description: `Has maxLength: ${field.maxLength}`,
        passed: true,
      });
    }
    if (field.tabindex) {
      conditions.push({
        description: `Has tabindex: ${field.tabindex}`,
        passed: true,
      });
    }
    if (field.elementNumber !== undefined) {
      conditions.push({
        description: `Element position: #${field.elementNumber}`,
        passed: true,
      });
    }

    // Login-related checks
    const isUsernameField = this.qualificationService.isUsernameField(field);
    conditions.push({
      description: "Is username field",
      passed: isUsernameField,
    });
    const isEmailField = this.qualificationService.isEmailField(field);
    conditions.push({
      description: "Is email field",
      passed: isEmailField,
    });
    const isCurrentPasswordField = this.qualificationService.isCurrentPasswordField(field);
    conditions.push({
      description: "Is current password field",
      passed: isCurrentPasswordField,
    });
    const isNewPasswordField = this.qualificationService.isNewPasswordField(field);
    conditions.push({
      description: "Is new password field",
      passed: isNewPasswordField,
    });
    const isUpdateCurrentPasswordField =
      this.qualificationService.isUpdateCurrentPasswordField(field);
    conditions.push({
      description: "Is update current password field",
      passed: isUpdateCurrentPasswordField,
    });
    const isTotpField = this.qualificationService.isTotpField(field);
    conditions.push({
      description: "Is TOTP field",
      passed: isTotpField,
    });

    // Form-level checks (used for qualification)
    const isForLoginForm = this.qualificationService.isFieldForLoginForm(field, pageDetails);
    conditions.push({
      description: "Is for login form",
      passed: isForLoginForm,
    });

    const isForCreditCardForm = this.qualificationService.isFieldForCreditCardForm(
      field,
      pageDetails,
    );
    conditions.push({
      description: "Is for credit card form",
      passed: isForCreditCardForm,
    });

    const isForAccountCreationForm = this.qualificationService.isFieldForAccountCreationForm(
      field,
      pageDetails,
    );
    conditions.push({
      description: "Is for account creation form",
      passed: isForAccountCreationForm,
    });

    const isForIdentityForm = this.qualificationService.isFieldForIdentityForm(field, pageDetails);
    conditions.push({
      description: "Is for identity form",
      passed: isForIdentityForm,
    });

    // Credit card-specific checks
    const isCardholderName = this.qualificationService.isFieldForCardholderName(field);
    conditions.push({
      description: "Is cardholder name field",
      passed: isCardholderName,
    });
    const isCardNumber = this.qualificationService.isFieldForCardNumber(field);
    conditions.push({
      description: "Is card number field",
      passed: isCardNumber,
    });
    const isCardExpirationDate = this.qualificationService.isFieldForCardExpirationDate(field);
    conditions.push({
      description: "Is card expiration date field",
      passed: isCardExpirationDate,
    });
    const isCardExpirationMonth = this.qualificationService.isFieldForCardExpirationMonth(field);
    conditions.push({
      description: "Is card expiration month field",
      passed: isCardExpirationMonth,
    });
    const isCardExpirationYear = this.qualificationService.isFieldForCardExpirationYear(field);
    conditions.push({
      description: "Is card expiration year field",
      passed: isCardExpirationYear,
    });
    const isCardCvv = this.qualificationService.isFieldForCardCvv(field);
    conditions.push({
      description: "Is card CVV field",
      passed: isCardCvv,
    });

    // Identity-specific checks
    const isIdentityTitle = this.qualificationService.isFieldForIdentityTitle(field);
    conditions.push({
      description: "Is identity title field",
      passed: isIdentityTitle,
    });
    const isIdentityFirstName = this.qualificationService.isFieldForIdentityFirstName(field);
    conditions.push({
      description: "Is identity first name field",
      passed: isIdentityFirstName,
    });
    const isIdentityMiddleName = this.qualificationService.isFieldForIdentityMiddleName(field);
    conditions.push({
      description: "Is identity middle name field",
      passed: isIdentityMiddleName,
    });
    const isIdentityLastName = this.qualificationService.isFieldForIdentityLastName(field);
    conditions.push({
      description: "Is identity last name field",
      passed: isIdentityLastName,
    });
    const isIdentityFullName = this.qualificationService.isFieldForIdentityFullName(field);
    conditions.push({
      description: "Is identity full name field",
      passed: isIdentityFullName,
    });
    const isIdentityAddress1 = this.qualificationService.isFieldForIdentityAddress1(field);
    conditions.push({
      description: "Is identity address 1 field",
      passed: isIdentityAddress1,
    });
    const isIdentityAddress2 = this.qualificationService.isFieldForIdentityAddress2(field);
    conditions.push({
      description: "Is identity address 2 field",
      passed: isIdentityAddress2,
    });
    const isIdentityAddress3 = this.qualificationService.isFieldForIdentityAddress3(field);
    conditions.push({
      description: "Is identity address 3 field",
      passed: isIdentityAddress3,
    });
    const isIdentityCity = this.qualificationService.isFieldForIdentityCity(field);
    conditions.push({
      description: "Is identity city field",
      passed: isIdentityCity,
    });
    const isIdentityState = this.qualificationService.isFieldForIdentityState(field);
    conditions.push({
      description: "Is identity state field",
      passed: isIdentityState,
    });
    const isIdentityPostalCode = this.qualificationService.isFieldForIdentityPostalCode(field);
    conditions.push({
      description: "Is identity postal code field",
      passed: isIdentityPostalCode,
    });
    const isIdentityCountry = this.qualificationService.isFieldForIdentityCountry(field);
    conditions.push({
      description: "Is identity country field",
      passed: isIdentityCountry,
    });
    const isIdentityCompany = this.qualificationService.isFieldForIdentityCompany(field);
    conditions.push({
      description: "Is identity company field",
      passed: isIdentityCompany,
    });
    const isIdentityPhone = this.qualificationService.isFieldForIdentityPhone(field);
    conditions.push({
      description: "Is identity phone field",
      passed: isIdentityPhone,
    });
    const isIdentityEmail = this.qualificationService.isFieldForIdentityEmail(field);
    conditions.push({
      description: "Is identity email field",
      passed: isIdentityEmail,
    });
    const isIdentityUsername = this.qualificationService.isFieldForIdentityUsername(field);
    conditions.push({
      description: "Is identity username field",
      passed: isIdentityUsername,
    });

    // Special Integrations Checks
    if (field["data-stripe"]) {
      conditions.push({
        description: `Has data-stripe: ${field["data-stripe"]}`,
        passed: true,
      });
    }
    if (field.inlineMenuFillType) {
      conditions.push({
        description: `Has inlineMenuFillType: ${field.inlineMenuFillType}`,
        passed: true,
      });
    }
    if (field.fieldQualifier) {
      conditions.push({
        description: `Has fieldQualifier: ${field.fieldQualifier}`,
        passed: true,
      });
    }
    if (field.accountCreationFieldType) {
      conditions.push({
        description: `Has accountCreationFieldType: ${field.accountCreationFieldType}`,
        passed: true,
      });
    }

    // Additional Field Attributes
    if (field.value) {
      const sanitized = this.sanitizeValue(field);
      conditions.push({
        description: `Has value: ${sanitized}`,
        passed: true,
      });
    }
    if (field.checked !== undefined) {
      conditions.push({
        description: `Checked state: ${field.checked ? "checked" : "unchecked"}`,
        passed: true,
      });
    }
    if (field.selectInfo) {
      const optionCount = Array.isArray(field.selectInfo.options)
        ? field.selectInfo.options.length
        : 0;
      conditions.push({
        description: `Has select options: ${optionCount} options available`,
        passed: true,
      });
    }
    if (field.rel) {
      conditions.push({
        description: `Has rel: ${field.rel}`,
        passed: true,
      });
    }
    if (field.showPasskeys) {
      conditions.push({
        description: `Show passkeys: ${field.showPasskeys}`,
        passed: true,
      });
    }
    if (field["aria-haspopup"]) {
      conditions.push({
        description: `Has ARIA-haspopup: ${field["aria-haspopup"]}`,
        passed: true,
      });
    }

    // Determine qualification based on form-level checks (matches AutofillOverlayContentService priority)
    let qualifiedAs: TriageQualification = TriageQualification.Ineligible;
    if (isForLoginForm) {
      qualifiedAs = TriageQualification.Login;
    } else if (isForCreditCardForm) {
      qualifiedAs = TriageQualification.CreditCard;
    } else if (isForAccountCreationForm) {
      qualifiedAs = TriageQualification.AccountCreation;
    } else if (isForIdentityForm) {
      qualifiedAs = TriageQualification.Identity;
    }

    // A field is eligible only when it qualified for a recognized autofill category.
    const eligible = qualifiedAs !== TriageQualification.Ineligible;

    return {
      htmlId: field.htmlID || undefined,
      htmlName: field.htmlName || undefined,
      htmlType: field.type || undefined,
      placeholder: field.placeholder || undefined,
      ariaLabel: field["label-aria"] || undefined,
      autocomplete: field.autoCompleteType || undefined,
      formIndex: field.form !== null && field.form !== undefined ? field.form : undefined,
      eligible,
      qualifiedAs,
      conditions,
      // New metadata properties
      viewable: field.viewable,
      readonly: field.readonly,
      disabled: field.disabled,
      tagName: field.tagName || undefined,
      elementNumber: field.elementNumber,
      labelLeft: field["label-left"] || undefined,
      labelRight: field["label-right"] || undefined,
      labelTag: field["label-tag"] || undefined,
      labelTop: field["label-top"] || undefined,
      htmlClass: field.htmlClass || undefined,
      title: field.title || undefined,
      tabindex: field.tabindex || undefined,
      maxLength:
        field.maxLength !== null && field.maxLength !== undefined ? field.maxLength : undefined,
      ariaHidden: field["aria-hidden"],
      ariaDisabled: field["aria-disabled"],
      dataStripe: field["data-stripe"] || undefined,
      inlineMenuFillType: field.inlineMenuFillType ? String(field.inlineMenuFillType) : undefined,
      fieldQualifier: field.fieldQualifier ? String(field.fieldQualifier) : undefined,
      accountCreationFieldType: field.accountCreationFieldType
        ? String(field.accountCreationFieldType)
        : undefined,
      // Form context and additional properties
      formContext: this.getFormContext(field, pageDetails),
      valuePreview: this.sanitizeValue(field),
      checked: field.checked,
      selectOptions: field.selectInfo?.options
        ? field.selectInfo.options.map((opt: unknown) => String(opt))
        : undefined,
      rel: field.rel || undefined,
      showPasskeys: field.showPasskeys,
      ariaHasPopup: field["aria-haspopup"],
    };
  }

  /**
   * Truncates text to a maximum length, adding ellipsis if truncated.
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "...";
  }

  /**
   * Sanitizes a field value for display, hiding sensitive information.
   */
  private sanitizeValue(field: AutofillField): string | undefined {
    if (!field.value) {
      return undefined;
    }

    // Never show password or sensitive autocomplete values
    if (field.type === "password") {
      return undefined;
    }

    if (
      field.autoCompleteType &&
      SENSITIVE_AUTOCOMPLETE_TYPES.some((type) => field.autoCompleteType?.includes(type))
    ) {
      return undefined;
    }

    // For other fields, show truncated value
    return this.truncateText(field.value, VALUE_PREVIEW_MAX_LENGTH);
  }

  /**
   * Looks up form context for a field.
   */
  private getFormContext(
    field: AutofillField,
    pageDetails: AutofillPageDetails,
  ): AutofillTriageFormContext | undefined {
    if (!field.form || !pageDetails.forms[field.form]) {
      return undefined;
    }

    const form = pageDetails.forms[field.form];
    const fieldsInForm = pageDetails.fields.filter((f) => f.form === field.form);

    return {
      htmlId: form.htmlID || undefined,
      htmlName: form.htmlName || undefined,
      htmlAction: form.htmlAction || undefined,
      htmlMethod: form.htmlMethod || undefined,
      fieldCount: fieldsInForm.length,
    };
  }
}
