import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../qualification/abstractions/qualification-engine";
import { FieldClassification } from "../../qualification/types/classification";
import { FieldRole } from "../../qualification/types/field-role";
import { FormCategory } from "../../qualification/types/form-category";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";

import { QualificationEngineAdapter } from "./qualification-engine.adapter";

function fieldClassification(
  roles: FieldRole[],
  formContexts: FormCategory[] = [],
): FieldClassification {
  return {
    matchedRoles: new Set(roles),
    matchedFormContexts: new Set(formContexts),
    topRole: roles[0] ?? null,
    confidence: roles.length > 0 ? "high" : "none",
    score: roles.length > 0 ? 100 : 0,
    allScores: [],
  };
}

describe("QualificationEngineAdapter", () => {
  let engine: MockProxy<QualificationEngine>;
  let legacy: MockProxy<InlineMenuFieldQualificationService>;
  let adapter: QualificationEngineAdapter;
  let pageDetails: AutofillPageDetails;
  let field: AutofillField;
  let form: AutofillForm;
  let pageQualification: MockProxy<PageQualification>;

  beforeEach(() => {
    engine = mock<QualificationEngine>();
    // The mock proxy auto-mocks every property including the optional readonly
    // Sets, but tests in this file exercise the "engine covers everything"
    // branch where the adapter routes every predicate through the engine.
    // Setting these to undefined makes `engine.coveredRoles?.has(...)` short-
    // circuit on the optional chain and trigger the `?? true` default.
    Object.defineProperty(engine, "coveredRoles", { value: undefined });
    Object.defineProperty(engine, "coveredCategories", { value: undefined });
    legacy = mock<InlineMenuFieldQualificationService>();
    adapter = new QualificationEngineAdapter(engine, legacy);

    field = mock<AutofillField>({ opid: "field-1", form: "form-1" });
    form = mock<AutofillForm>({ opid: "form-1" });
    pageDetails = mock<AutofillPageDetails>({ forms: {}, fields: [] });
    // jest-mock-extended does not preserve MockProxy references inside partial
    // collection values, so we assign these after construction.
    pageDetails.forms = { "form-1": form };
    pageDetails.fields = [field];
    pageQualification = mock<PageQualification>();
    engine.classify.mockReturnValue(pageQualification);
  });

  describe("before enroll()", () => {
    it("falls through to legacy for field-only methods when the field is unknown", () => {
      legacy.isUsernameField.mockReturnValue(true);
      legacy.isCurrentPasswordField.mockReturnValue(false);

      expect(adapter.isUsernameField(field)).toBe(true);
      expect(adapter.isCurrentPasswordField(field)).toBe(false);
      expect(legacy.isUsernameField).toHaveBeenCalledWith(field);
      expect(legacy.isCurrentPasswordField).toHaveBeenCalledWith(field);
    });
  });

  describe("after enroll()", () => {
    beforeEach(() => {
      pageQualification.fieldFor.mockImplementation((opid) =>
        opid === "field-1" ? fieldClassification([FieldRole.Username, FieldRole.Email]) : null,
      );
      adapter.enroll(pageDetails);
    });

    it("returns true for roles in the field's matchedRoles", () => {
      expect(adapter.isUsernameField(field)).toBe(true);
      expect(adapter.isEmailField(field)).toBe(true);
    });

    it("returns false for roles not in the field's matchedRoles", () => {
      expect(adapter.isCurrentPasswordField(field)).toBe(false);
      expect(adapter.isFieldForCardCvv(field)).toBe(false);
    });

    it("does not call the legacy service for covered roles on enrolled fields", () => {
      adapter.isUsernameField(field);
      adapter.isCurrentPasswordField(field);
      expect(legacy.isUsernameField).not.toHaveBeenCalled();
      expect(legacy.isCurrentPasswordField).not.toHaveBeenCalled();
    });
  });

  describe("form-context methods", () => {
    beforeEach(() => {
      pageQualification.fieldFor.mockImplementation((opid) =>
        opid === "field-1"
          ? fieldClassification(
              [FieldRole.Username],
              [FormCategory.Login, FormCategory.AccountCreation],
            )
          : null,
      );
    });

    it("auto-enrolls the supplied pageDetails on first call", () => {
      expect(adapter.isFieldForLoginForm(field, pageDetails)).toBe(true);
      expect(engine.classify).toHaveBeenCalledWith(pageDetails);
    });

    it("returns true for form contexts the field qualifies for", () => {
      expect(adapter.isFieldForLoginForm(field, pageDetails)).toBe(true);
      expect(adapter.isFieldForAccountCreationForm(field, pageDetails)).toBe(true);
    });

    it("returns false for form contexts the field does not qualify for", () => {
      expect(adapter.isFieldForCreditCardForm(field, pageDetails)).toBe(false);
      expect(adapter.isFieldForIdentityForm(field, pageDetails)).toBe(false);
    });
  });

  describe("legacy-delegated methods", () => {
    it("delegates isElementLoginSubmitButton to the legacy service", () => {
      const element = document.createElement("button");
      legacy.isElementLoginSubmitButton.mockReturnValue(true);
      expect(adapter.isElementLoginSubmitButton(element)).toBe(true);
      expect(legacy.isElementLoginSubmitButton).toHaveBeenCalledWith(element);
    });

    it("delegates isElementChangePasswordSubmitButton to the legacy service", () => {
      const element = document.createElement("button");
      legacy.isElementChangePasswordSubmitButton.mockReturnValue(true);
      expect(adapter.isElementChangePasswordSubmitButton(element)).toBe(true);
      expect(legacy.isElementChangePasswordSubmitButton).toHaveBeenCalledWith(element);
    });

    it("delegates hasCurrentPasswordAutocomplete to the legacy service", () => {
      legacy.hasCurrentPasswordAutocomplete.mockReturnValue(true);
      expect(adapter.hasCurrentPasswordAutocomplete(field)).toBe(true);
      expect(legacy.hasCurrentPasswordAutocomplete).toHaveBeenCalledWith(field);
    });
  });

  describe("split-routing on declared coverage", () => {
    let coveredEngine: MockProxy<QualificationEngine>;
    let coveredAdapter: QualificationEngineAdapter;

    beforeEach(() => {
      coveredEngine = mock<QualificationEngine>();
      // Engine declares it covers only the credential roles + login category.
      // Everything else must fall through to the legacy service.
      Object.defineProperty(coveredEngine, "coveredRoles", {
        value: new Set<FieldRole>([
          FieldRole.Username,
          FieldRole.CurrentPassword,
          FieldRole.NewPassword,
          FieldRole.Email,
          FieldRole.Totp,
        ]),
      });
      Object.defineProperty(coveredEngine, "coveredCategories", {
        value: new Set<FormCategory>([FormCategory.Login]),
      });
      coveredEngine.classify.mockReturnValue(pageQualification);
      coveredAdapter = new QualificationEngineAdapter(coveredEngine, legacy);
      pageQualification.fieldFor.mockImplementation((opid) =>
        opid === "field-1" ? fieldClassification([FieldRole.Username], [FormCategory.Login]) : null,
      );
      coveredAdapter.enroll(pageDetails);
    });

    it("routes covered role predicates through the engine", () => {
      expect(coveredAdapter.isUsernameField(field)).toBe(true);
      expect(legacy.isUsernameField).not.toHaveBeenCalled();
    });

    it("falls through to legacy for uncovered role predicates", () => {
      legacy.isFieldForCardNumber.mockReturnValue(true);
      expect(coveredAdapter.isFieldForCardNumber(field)).toBe(true);
      expect(legacy.isFieldForCardNumber).toHaveBeenCalledWith(field);
    });

    it("falls through to legacy for uncovered identity predicates", () => {
      legacy.isFieldForIdentityEmail.mockReturnValue(true);
      expect(coveredAdapter.isFieldForIdentityEmail(field)).toBe(true);
      expect(legacy.isFieldForIdentityEmail).toHaveBeenCalledWith(field);
    });

    it("routes covered form-context predicates through the engine", () => {
      expect(coveredAdapter.isFieldForLoginForm(field, pageDetails)).toBe(true);
      expect(legacy.isFieldForLoginForm).not.toHaveBeenCalled();
    });

    it("falls through to legacy for uncovered form-context predicates", () => {
      legacy.isFieldForCreditCardForm.mockReturnValue(true);
      expect(coveredAdapter.isFieldForCreditCardForm(field, pageDetails)).toBe(true);
      expect(legacy.isFieldForCreditCardForm).toHaveBeenCalledWith(field, pageDetails);
    });
  });

  describe("method binding", () => {
    it("supports extracting boolean methods as unbound references", () => {
      pageQualification.fieldFor.mockReturnValue(fieldClassification([FieldRole.Username]));
      adapter.enroll(pageDetails);

      // Mirrors the pattern in AutofillOverlayContentService:106-162 — the
      // qualifier method is extracted into a Record<string, CallableFunction>
      // and later invoked as a bare function with no `this` context.
      const unbound = adapter.isUsernameField;
      expect(unbound(field)).toBe(true);
    });
  });
});
