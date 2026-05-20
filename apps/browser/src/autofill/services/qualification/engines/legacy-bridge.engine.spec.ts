import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../../../models/autofill-field";
import AutofillForm from "../../../models/autofill-form";
import AutofillPageDetails from "../../../models/autofill-page-details";
import { InlineMenuFieldQualificationService } from "../../abstractions/inline-menu-field-qualifications.service";
import { FieldRole } from "../types/field-role";
import { FormCategory } from "../types/form-category";

import { LegacyBridgeEngine } from "./legacy-bridge.engine";

describe("LegacyBridgeEngine", () => {
  let legacy: MockProxy<InlineMenuFieldQualificationService>;
  let engine: LegacyBridgeEngine;
  let pageDetails: MockProxy<AutofillPageDetails>;

  beforeEach(() => {
    legacy = mock<InlineMenuFieldQualificationService>();
    engine = new LegacyBridgeEngine(legacy);
    pageDetails = mock<AutofillPageDetails>({ forms: {}, fields: [] });
  });

  describe("classify().fieldFor", () => {
    it("returns null for an opid not present in the page", () => {
      const result = engine.classify(pageDetails);
      expect(result.fieldFor("does-not-exist")).toBeNull();
    });

    it("includes a role in matchedRoles when the legacy predicate returns true", () => {
      const field = mock<AutofillField>({ opid: "field-1" });
      pageDetails.fields = [field];
      legacy.isUsernameField.mockReturnValue(true);

      const classification = engine.classify(pageDetails).fieldFor("field-1");

      expect(classification).not.toBeNull();
      expect(classification!.matchedRoles.has(FieldRole.Username)).toBe(true);
      expect(classification!.confidence).toBe("high");
    });

    it("includes multiple roles when multiple legacy predicates return true", () => {
      const field = mock<AutofillField>({ opid: "field-1" });
      pageDetails.fields = [field];
      legacy.isUsernameField.mockReturnValue(true);
      legacy.isFieldForIdentityFirstName.mockReturnValue(true);

      const classification = engine.classify(pageDetails).fieldFor("field-1")!;

      expect(classification.matchedRoles.has(FieldRole.Username)).toBe(true);
      expect(classification.matchedRoles.has(FieldRole.IdentityFirstName)).toBe(true);
    });

    it("records per-field form contexts from isFieldFor*Form predicates", () => {
      const field = mock<AutofillField>({ opid: "field-1" });
      pageDetails.fields = [field];
      legacy.isFieldForLoginForm.mockReturnValue(true);
      legacy.isFieldForAccountCreationForm.mockReturnValue(true);

      const classification = engine.classify(pageDetails).fieldFor("field-1")!;

      expect(classification.matchedFormContexts.has(FormCategory.Login)).toBe(true);
      expect(classification.matchedFormContexts.has(FormCategory.AccountCreation)).toBe(true);
      expect(classification.matchedFormContexts.has(FormCategory.Identity)).toBe(false);
    });

    it("returns 'none' confidence when no legacy predicates match", () => {
      const field = mock<AutofillField>({ opid: "field-1" });
      pageDetails.fields = [field];

      const classification = engine.classify(pageDetails).fieldFor("field-1")!;

      expect(classification.matchedRoles.size).toBe(0);
      expect(classification.confidence).toBe("none");
      expect(classification.topRole).toBeNull();
    });
  });

  describe("classify().formFor", () => {
    it("returns null for an opid not present in the page", () => {
      const result = engine.classify(pageDetails);
      expect(result.formFor("does-not-exist")).toBeNull();
    });

    it("classifies a form as Login when any field matches isFieldForLoginForm", () => {
      const field = mock<AutofillField>({ opid: "field-1", form: "form-1" });
      const form = mock<AutofillForm>({ opid: "form-1" });
      pageDetails.fields = [field];
      pageDetails.forms = { "form-1": form };
      legacy.isFieldForLoginForm.mockReturnValue(true);

      const classification = engine.classify(pageDetails).formFor("form-1")!;

      expect(classification.matchedCategories.has(FormCategory.Login)).toBe(true);
      expect(classification.topCategory).toBe(FormCategory.Login);
    });

    it("can match multiple categories on the same form", () => {
      const field = mock<AutofillField>({ opid: "field-1", form: "form-1" });
      const form = mock<AutofillForm>({ opid: "form-1" });
      pageDetails.fields = [field];
      pageDetails.forms = { "form-1": form };
      legacy.isFieldForLoginForm.mockReturnValue(true);
      legacy.isFieldForAccountCreationForm.mockReturnValue(true);

      const classification = engine.classify(pageDetails).formFor("form-1")!;

      expect(classification.matchedCategories.has(FormCategory.Login)).toBe(true);
      expect(classification.matchedCategories.has(FormCategory.AccountCreation)).toBe(true);
    });

    it("returns 'none' confidence when no category predicates match", () => {
      const form = mock<AutofillForm>({ opid: "form-1" });
      pageDetails.forms = { "form-1": form };

      const classification = engine.classify(pageDetails).formFor("form-1")!;

      expect(classification.matchedCategories.size).toBe(0);
      expect(classification.confidence).toBe("none");
    });
  });

  describe("classify().scenario", () => {
    it("returns null — the legacy bridge does not synthesize page scenarios", () => {
      expect(engine.classify(pageDetails).scenario()).toBeNull();
    });
  });
});
