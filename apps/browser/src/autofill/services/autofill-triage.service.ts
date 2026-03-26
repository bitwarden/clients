import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import { AutofillTriageConditionResult, AutofillTriageFieldResult } from "../types/autofill-triage";

import { AutofillTriageService as AutofillTriageServiceInterface } from "./abstractions/autofill-triage.service";
import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";

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

    // Login-related checks
    conditions.push({
      description: "Is username field",
      passed: this.qualificationService.isUsernameField(field),
    });
    conditions.push({
      description: "Is email field",
      passed: this.qualificationService.isEmailField(field),
    });
    conditions.push({
      description: "Is current password field",
      passed: this.qualificationService.isCurrentPasswordField(field),
    });
    conditions.push({
      description: "Is new password field",
      passed: this.qualificationService.isNewPasswordField(field),
    });
    conditions.push({
      description: "Is update current password field",
      passed: this.qualificationService.isUpdateCurrentPasswordField(field),
    });
    conditions.push({
      description: "Is TOTP field",
      passed: this.qualificationService.isTotpField(field),
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
    conditions.push({
      description: "Is cardholder name field",
      passed: this.qualificationService.isFieldForCardholderName(field),
    });
    conditions.push({
      description: "Is card number field",
      passed: this.qualificationService.isFieldForCardNumber(field),
    });
    conditions.push({
      description: "Is card expiration date field",
      passed: this.qualificationService.isFieldForCardExpirationDate(field),
    });
    conditions.push({
      description: "Is card expiration month field",
      passed: this.qualificationService.isFieldForCardExpirationMonth(field),
    });
    conditions.push({
      description: "Is card expiration year field",
      passed: this.qualificationService.isFieldForCardExpirationYear(field),
    });
    conditions.push({
      description: "Is card CVV field",
      passed: this.qualificationService.isFieldForCardCvv(field),
    });

    // Identity-specific checks
    conditions.push({
      description: "Is identity title field",
      passed: this.qualificationService.isFieldForIdentityTitle(field),
    });
    conditions.push({
      description: "Is identity first name field",
      passed: this.qualificationService.isFieldForIdentityFirstName(field),
    });
    conditions.push({
      description: "Is identity middle name field",
      passed: this.qualificationService.isFieldForIdentityMiddleName(field),
    });
    conditions.push({
      description: "Is identity last name field",
      passed: this.qualificationService.isFieldForIdentityLastName(field),
    });
    conditions.push({
      description: "Is identity full name field",
      passed: this.qualificationService.isFieldForIdentityFullName(field),
    });
    conditions.push({
      description: "Is identity address 1 field",
      passed: this.qualificationService.isFieldForIdentityAddress1(field),
    });
    conditions.push({
      description: "Is identity address 2 field",
      passed: this.qualificationService.isFieldForIdentityAddress2(field),
    });
    conditions.push({
      description: "Is identity address 3 field",
      passed: this.qualificationService.isFieldForIdentityAddress3(field),
    });
    conditions.push({
      description: "Is identity city field",
      passed: this.qualificationService.isFieldForIdentityCity(field),
    });
    conditions.push({
      description: "Is identity state field",
      passed: this.qualificationService.isFieldForIdentityState(field),
    });
    conditions.push({
      description: "Is identity postal code field",
      passed: this.qualificationService.isFieldForIdentityPostalCode(field),
    });
    conditions.push({
      description: "Is identity country field",
      passed: this.qualificationService.isFieldForIdentityCountry(field),
    });
    conditions.push({
      description: "Is identity company field",
      passed: this.qualificationService.isFieldForIdentityCompany(field),
    });
    conditions.push({
      description: "Is identity phone field",
      passed: this.qualificationService.isFieldForIdentityPhone(field),
    });
    conditions.push({
      description: "Is identity email field",
      passed: this.qualificationService.isFieldForIdentityEmail(field),
    });
    conditions.push({
      description: "Is identity username field",
      passed: this.qualificationService.isFieldForIdentityUsername(field),
    });

    // Determine qualification based on form-level checks (matches AutofillOverlayContentService priority)
    let qualifiedAs = "ineligible";
    if (isForLoginForm) {
      qualifiedAs = "login";
    } else if (isForCreditCardForm) {
      qualifiedAs = "creditCard";
    } else if (isForAccountCreationForm) {
      qualifiedAs = "accountCreation";
    } else if (isForIdentityForm) {
      qualifiedAs = "identity";
    }

    // Determine if field is eligible (any check passed)
    const eligible = conditions.some((c) => c.passed);

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
    };
  }
}
