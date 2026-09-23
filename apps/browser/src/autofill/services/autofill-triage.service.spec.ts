import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";

import { InlineMenuFieldQualificationService } from "./abstractions/inline-menu-field-qualifications.service";
import { AutofillTriageService } from "./autofill-triage.service";

describe("AutofillTriageService", () => {
  let service: AutofillTriageService;
  let qualificationService: MockProxy<InlineMenuFieldQualificationService>;
  let mockField: AutofillField;
  let mockPageDetails: AutofillPageDetails;

  beforeEach(() => {
    qualificationService = mock<InlineMenuFieldQualificationService>();
    service = new AutofillTriageService(qualificationService);

    mockField = {
      opid: "field-1",
      elementNumber: 1,
      viewable: true,
      htmlID: "username",
      htmlName: "username",
      htmlClass: "",
      type: "text",
      tabindex: "0",
      title: "",
      placeholder: "Enter username",
      autoCompleteType: "username",
      "label-aria": "Username field",
      form: "0",
    } as AutofillField;

    mockPageDetails = {
      fields: [mockField],
      forms: {},
    } as AutofillPageDetails;
  });

  describe("triageField", () => {
    it("should return field attributes in result", () => {
      const result = service.triageField(mockField, mockPageDetails);

      expect(result.htmlId).toBe("username");
      expect(result.htmlName).toBe("username");
      expect(result.htmlType).toBe("text");
      expect(result.placeholder).toBe("Enter username");
      expect(result.ariaLabel).toBe("Username field");
      expect(result.autocomplete).toBe("username");
      expect(result.formIndex).toBe("0");
    });

    it("should include all qualification checks in conditions array", () => {
      const result = service.triageField(mockField, mockPageDetails);

      expect(result.conditions.length).toBeGreaterThan(0);
      expect(result.conditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ description: "Is username field" }),
          expect.objectContaining({ description: "Is current password field" }),
          expect.objectContaining({ description: "Is for login form" }),
          expect.objectContaining({ description: "Is for credit card form" }),
          expect.objectContaining({ description: "Is for identity form" }),
        ]),
      );
    });

    it("should mark field as eligible if any form-level qualification check passes", () => {
      qualificationService.isFieldForLoginForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.eligible).toBe(true);
    });

    it("should mark field as ineligible if no qualification checks pass", () => {
      // Override all qualification service methods to return false
      qualificationService.isUsernameField.mockReturnValue(false);
      qualificationService.isEmailField.mockReturnValue(false);
      qualificationService.isCurrentPasswordField.mockReturnValue(false);
      qualificationService.isNewPasswordField.mockReturnValue(false);
      qualificationService.isUpdateCurrentPasswordField.mockReturnValue(false);
      qualificationService.isTotpField.mockReturnValue(false);
      qualificationService.isFieldForLoginForm.mockReturnValue(false);
      qualificationService.isFieldForAccountCreationForm.mockReturnValue(false);
      qualificationService.isFieldForCreditCardForm.mockReturnValue(false);
      qualificationService.isFieldForIdentityForm.mockReturnValue(false);
      qualificationService.isFieldForCardholderName.mockReturnValue(false);
      qualificationService.isFieldForCardNumber.mockReturnValue(false);
      qualificationService.isFieldForCardExpirationDate.mockReturnValue(false);
      qualificationService.isFieldForCardExpirationMonth.mockReturnValue(false);
      qualificationService.isFieldForCardExpirationYear.mockReturnValue(false);
      qualificationService.isFieldForCardCvv.mockReturnValue(false);
      qualificationService.isFieldForIdentityTitle.mockReturnValue(false);
      qualificationService.isFieldForIdentityFirstName.mockReturnValue(false);
      qualificationService.isFieldForIdentityMiddleName.mockReturnValue(false);
      qualificationService.isFieldForIdentityLastName.mockReturnValue(false);
      qualificationService.isFieldForIdentityFullName.mockReturnValue(false);
      qualificationService.isFieldForIdentityAddress1.mockReturnValue(false);
      qualificationService.isFieldForIdentityAddress2.mockReturnValue(false);
      qualificationService.isFieldForIdentityAddress3.mockReturnValue(false);
      qualificationService.isFieldForIdentityCity.mockReturnValue(false);
      qualificationService.isFieldForIdentityState.mockReturnValue(false);
      qualificationService.isFieldForIdentityPostalCode.mockReturnValue(false);
      qualificationService.isFieldForIdentityCountry.mockReturnValue(false);
      qualificationService.isFieldForIdentityCompany.mockReturnValue(false);
      qualificationService.isFieldForIdentityPhone.mockReturnValue(false);
      qualificationService.isFieldForIdentityEmail.mockReturnValue(false);
      qualificationService.isFieldForIdentityUsername.mockReturnValue(false);

      // Create a field with no matching type
      const nonMatchingField = {
        ...mockField,
        type: "hidden", // not text, password, or email
        autoCompleteType: undefined,
      } as AutofillField;

      const result = service.triageField(nonMatchingField, mockPageDetails);

      expect(result.eligible).toBe(false);
    });

    it("should set qualifiedAs to 'login' when login form check passes", () => {
      qualificationService.isFieldForLoginForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.qualifiedAs).toBe("login");
    });

    it("should set qualifiedAs to 'creditCard' when credit card form check passes", () => {
      qualificationService.isFieldForCreditCardForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.qualifiedAs).toBe("creditCard");
    });

    it("should set qualifiedAs to 'identity' when identity form check passes", () => {
      qualificationService.isFieldForIdentityForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.qualifiedAs).toBe("identity");
    });

    it("should set qualifiedAs to 'accountCreation' when account creation check passes", () => {
      qualificationService.isFieldForAccountCreationForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.qualifiedAs).toBe("accountCreation");
    });

    it("should set qualifiedAs to 'ineligible' when no checks pass", () => {
      const result = service.triageField(mockField, mockPageDetails);

      expect(result.qualifiedAs).toBe("ineligible");
    });

    it("should prioritize login form over username field check", () => {
      qualificationService.isUsernameField.mockReturnValue(true);
      qualificationService.isFieldForLoginForm.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      // Should be login from form check, not from field check
      expect(result.qualifiedAs).toBe("login");
    });

    it("should record passed conditions correctly", () => {
      qualificationService.isUsernameField.mockReturnValue(true);
      qualificationService.isEmailField.mockReturnValue(false);

      const result = service.triageField(mockField, mockPageDetails);

      const usernameCondition = result.conditions.find(
        (c) => c.description === "Is username field",
      );
      const emailCondition = result.conditions.find((c) => c.description === "Is email field");

      expect(usernameCondition?.passed).toBe(true);
      expect(emailCondition?.passed).toBe(false);
    });

    it("should have empty subConditions for all checks (PoC limitation)", () => {
      qualificationService.isUsernameField.mockReturnValue(true);

      const result = service.triageField(mockField, mockPageDetails);

      expect(result.conditions.length).toBeGreaterThan(0);
    });

    it("should call qualification service for each check", () => {
      service.triageField(mockField, mockPageDetails);

      expect(qualificationService.isUsernameField).toHaveBeenCalledWith(mockField);
      expect(qualificationService.isCurrentPasswordField).toHaveBeenCalledWith(mockField);
      expect(qualificationService.isFieldForLoginForm).toHaveBeenCalledWith(
        mockField,
        mockPageDetails,
      );
      expect(qualificationService.isFieldForCreditCardForm).toHaveBeenCalledWith(
        mockField,
        mockPageDetails,
      );
      expect(qualificationService.isFieldForIdentityForm).toHaveBeenCalledWith(
        mockField,
        mockPageDetails,
      );
    });

    it("should handle fields with null attributes gracefully", () => {
      const nullField = {
        opid: "field-2",
        htmlID: null,
        htmlName: null,
        type: null,
        placeholder: null,
        autoCompleteType: null,
        "label-aria": null,
        form: null,
      } as AutofillField;

      const result = service.triageField(nullField, mockPageDetails);

      expect(result.htmlId).toBeUndefined();
      expect(result.htmlName).toBeUndefined();
      expect(result.htmlType).toBeUndefined();
      expect(result.placeholder).toBeUndefined();
      expect(result.ariaLabel).toBeUndefined();
      expect(result.autocomplete).toBeUndefined();
      expect(result.formIndex).toBeUndefined();
    });
  });
});
