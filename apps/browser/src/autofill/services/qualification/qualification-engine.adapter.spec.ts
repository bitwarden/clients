import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";

import { PageQualification, QualificationEngine } from "./abstractions/qualification-engine";
import { QualificationEngineAdapter } from "./qualification-engine.adapter";
import { FieldClassification } from "./types/classification";
import { FieldRole } from "./types/field-role";
import { FormCategory } from "./types/form-category";


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
    it("returns false from field-only methods when the field is unknown", () => {
      expect(adapter.isUsernameField(field)).toBe(false);
      expect(adapter.isCurrentPasswordField(field)).toBe(false);
      expect(adapter.isFieldForCardCvv(field)).toBe(false);
    });
  });

  describe("after enroll()", () => {
    beforeEach(() => {
      pageQualification.fieldFor.mockImplementation((opid) =>
        opid === "field-1" ? fieldClassification([FieldRole.Username, FieldRole.Email]) : null,
      );
      adapter.enroll(pageDetails);
    });

    it("classifies the page once per pageDetails snapshot", () => {
      adapter.enroll(pageDetails);
      adapter.enroll(pageDetails);
      expect(engine.classify).toHaveBeenCalledTimes(1);
    });

    it("returns true for roles in the field's matchedRoles", () => {
      expect(adapter.isUsernameField(field)).toBe(true);
      expect(adapter.isEmailField(field)).toBe(true);
    });

    it("returns false for roles not in the field's matchedRoles", () => {
      expect(adapter.isCurrentPasswordField(field)).toBe(false);
      expect(adapter.isFieldForCardCvv(field)).toBe(false);
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
