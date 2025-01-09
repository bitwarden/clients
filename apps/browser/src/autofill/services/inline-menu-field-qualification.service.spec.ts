import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";

import { AutoFillConstants } from "./autofill-constants";
import { InlineMenuFieldQualificationService } from "./inline-menu-field-qualification.service";

describe("InlineMenuFieldQualificationService", () => {
  let pageDetails: MockProxy<AutofillPageDetails>;
  let inlineMenuFieldQualificationService: InlineMenuFieldQualificationService;

  beforeEach(() => {
    pageDetails = mock<AutofillPageDetails>({
      forms: {},
      fields: [],
    });
    inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    inlineMenuFieldQualificationService["inlineMenuFieldQualificationFlagSet"] = true;
  });

  describe("isFieldForLoginForm", () => {
    it("does not disqualify totp fields for premium users with flag set to true", () => {
      inlineMenuFieldQualificationService["inlineMenuTotpFeatureFlag"] = true;
      inlineMenuFieldQualificationService["premiumEnabled"] = true;
      const field = mock<AutofillField>({
        type: "text",
        autoCompleteType: "one-time-code",
        htmlName: "totp",
        htmlID: "totp",
        placeholder: "totp",
      });

      expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
        true,
      );
    });

    it("disqualifies totp fields for premium users with flag set to false", () => {
      inlineMenuFieldQualificationService["inlineMenuTotpFeatureFlag"] = false;
      inlineMenuFieldQualificationService["inlineMenuTotpFeatureFlag"] = true;
      const field = mock<AutofillField>({
        type: "text",
        autoCompleteType: "one-time-code",
        htmlName: "totp",
        htmlID: "totp",
        placeholder: "totp",
      });

      expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
        false,
      );
    });

    it("disqualifies totp fields for non-premium users with flag set to true", () => {
      inlineMenuFieldQualificationService["inlineMenuTotpFeatureFlag"] = true;
      inlineMenuFieldQualificationService["premiumEnabled"] = false;
      const field = mock<AutofillField>({
        type: "text",
        autoCompleteType: "one-time-code",
        htmlName: "totp",
        htmlID: "totp",
        placeholder: "totp",
      });

      expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
        false,
      );
    });

    describe("qualifying a password field for a login form", () => {
      describe("an invalid password field", () => {
        it("has a `new-password` autoCompleteType", () => {
          const field = mock<AutofillField>({
            type: "password",
            autoCompleteType: "new-password",
            htmlName: "input-password",
            htmlID: "input-password",
            placeholder: "input-password",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            false,
          );
        });

        it("has a keyword value that indicates the field is for a create account form", () => {
          const field = mock<AutofillField>({
            type: "password",
            placeholder: "create account password",
            autoCompleteType: "",
            htmlName: "input-password",
            htmlID: "input-password",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            false,
          );
        });

        it("has a type that is an excluded type", () => {
          AutoFillConstants.ExcludedAutofillLoginTypes.forEach((excludedType) => {
            const field = mock<AutofillField>({
              type: excludedType,
              autoCompleteType: "",
            });

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });

        it("has an attribute present on the FieldIgnoreList, indicating that the field is a captcha", () => {
          AutoFillConstants.FieldIgnoreList.forEach((attribute, index) => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: index === 0 ? attribute : "",
              htmlName: index === 1 ? attribute : "",
              placeholder: index > 1 ? attribute : "",
              autoCompleteType: "",
            });

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });

        it("has a type other than `password` or `text`", () => {
          const field = mock<AutofillField>({
            type: "number",
            htmlID: "not-password",
            htmlName: "not-password",
            placeholder: "not-password",
            autoCompleteType: "",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            false,
          );
        });

        it("has a type of `text` without an attribute that indicates the field is a password field", () => {
          const field = mock<AutofillField>({
            type: "text",
            htmlID: "something-else",
            htmlName: "something-else",
            placeholder: "something-else",
            autoCompleteType: "",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            false,
          );
        });

        it("has a type of `text` and contains attributes that indicates the field is a search field", () => {
          const field = mock<AutofillField>({
            type: "text",
            htmlID: "search",
            htmlName: "something-else",
            placeholder: "something-else",
            autoCompleteType: "",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            false,
          );
        });

        describe("does not have a parent form element", () => {
          beforeEach(() => {
            pageDetails.forms = {};
          });

          it("on a page that has more than one password field", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "",
              autoCompleteType: "",
            });
            const secondField = mock<AutofillField>({
              type: "password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, secondField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });

          it("on a page that has more than one visible username field", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "",
              autoCompleteType: "",
            });
            const usernameField = mock<AutofillField>({
              type: "text",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              autoCompleteType: "",
            });
            const secondUsernameField = mock<AutofillField>({
              type: "text",
              htmlID: "some-other-user-username",
              htmlName: "some-other-user-username",
              placeholder: "some-other-user-username",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, usernameField, secondUsernameField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });

          it("has a disabled `autocompleteType` value", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "",
              autoCompleteType: "off",
            });

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });

        describe("has a parent form element", () => {
          let form: MockProxy<AutofillForm>;

          beforeEach(() => {
            form = mock<AutofillForm>({ opid: "validFormId" });
            pageDetails.forms = {
              validFormId: form,
            };
          });

          it("is structured with other password fields in the same form", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
              autoCompleteType: "",
            });
            const secondField = mock<AutofillField>({
              type: "password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
              form: "validFormId",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, secondField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });
      });

      describe("a valid password field", () => {
        it("has an autoCompleteType of `current-password`", () => {
          const field = mock<AutofillField>({
            type: "password",
            autoCompleteType: "current-password",
            htmlID: "user-password",
            htmlName: "user-password",
            placeholder: "user-password",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            true,
          );
        });

        it("is structured on a page with a single set of username and password fields", () => {
          const field = mock<AutofillField>({
            type: "password",
            htmlID: "user-password",
            htmlName: "user-password",
            placeholder: "user-password",
            autoCompleteType: "",
          });
          const usernameField = mock<AutofillField>({
            type: "text",
            htmlID: "user-username",
            htmlName: "user-username",
            placeholder: "user-username",
            autoCompleteType: "",
          });
          pageDetails.fields = [field, usernameField];

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            true,
          );
        });

        it("has a type of `text` with an attribute that indicates the field is a password field", () => {
          const field = mock<AutofillField>({
            type: "text",
            htmlID: null,
            htmlName: "user-password",
            placeholder: "user-password",
            autoCompleteType: "",
          });

          expect(inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails)).toBe(
            true,
          );
        });

        describe("does not have a parent form element", () => {
          it("is the only password field on the page, has one username field on the page, and has a non-disabled `autocompleteType` value", () => {
            pageDetails.forms = {};
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "",
              autoCompleteType: "current-password",
            });
            const usernameField = mock<AutofillField>({
              type: "text",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, usernameField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });
        });

        describe("has a parent form element", () => {
          let form: MockProxy<AutofillForm>;

          beforeEach(() => {
            form = mock<AutofillForm>({ opid: "validFormId" });
            pageDetails.forms = {
              validFormId: form,
            };
          });

          it("is the only password field within the form and has a visible username field", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
              autoCompleteType: "",
            });
            const secondPasswordField = mock<AutofillField>({
              type: "password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
              form: "anotherFormId",
              autoCompleteType: "",
            });
            const usernameField = mock<AutofillField>({
              type: "text",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, secondPasswordField, usernameField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });

          it("is the only password field within the form and has a non-disabled `autocompleteType` value", () => {
            const field = mock<AutofillField>({
              type: "password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
              autoCompleteType: "",
            });
            const secondPasswordField = mock<AutofillField>({
              type: "password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
              form: "anotherFormId",
              autoCompleteType: "",
            });
            pageDetails.fields = [field, secondPasswordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });
        });
      });
    });

    describe("qualifying a username field for a login form", () => {
      describe("an invalid username field", () => {
        ["username", "email"].forEach((autoCompleteType) => {
          it(`has a ${autoCompleteType} 'autoCompleteType' value when structured on a page with new password fields`, () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType,
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "new-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "new password",
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });

        ["new", "change", "neue", "ändern", "register", "create", "registration"].forEach(
          (keyword) => {
            it(`has a keyword of ${keyword} that indicates a 'new or changed' username is being filled`, () => {
              const field = mock<AutofillField>({
                type: "text",
                autoCompleteType: "",
                htmlID: "user-username",
                htmlName: "user-username",
                placeholder: `${keyword} username`,
              });

              expect(
                inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
              ).toBe(false);
            });
          },
        );

        describe("does not have a parent form element", () => {
          beforeEach(() => {
            pageDetails.forms = {};
          });

          it("is structured on a page with multiple password fields", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
            });
            const secondPasswordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
            });
            pageDetails.fields = [field, passwordField, secondPasswordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });

        describe("has a parent form element", () => {
          let form: MockProxy<AutofillForm>;

          beforeEach(() => {
            form = mock<AutofillForm>({ opid: "validFormId" });
            pageDetails.forms = {
              validFormId: form,
            };
          });

          it("is structured on a page with no password fields and has a disabled `autoCompleteType` value", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "off",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            pageDetails.fields = [field];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });

          it("is structured on a page with no password fields but has other types of fields in the form", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            const otherField = mock<AutofillField>({
              type: "number",
              autoCompleteType: "",
              htmlID: "some-other-field",
              htmlName: "some-other-field",
              placeholder: "some-other-field",
              form: "validFormId",
            });
            pageDetails.fields = [field, otherField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });

          it("is structured on a page with multiple viewable password fields", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
            });
            const secondPasswordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "some-other-password",
              htmlName: "some-other-password",
              placeholder: "some-other-password",
              form: "validFormId",
            });
            pageDetails.fields = [field, passwordField, secondPasswordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });

          it("contains a disabled autocomplete type when multiple password fields are on the page", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "off",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
              viewable: false,
            });
            const secondPasswordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "second-password",
              htmlName: "second-password",
              placeholder: "second-password",
              form: "validFormId",
              viewable: false,
            });
            pageDetails.fields = [field, passwordField, secondPasswordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(false);
          });
        });
      });

      describe("a valid username field", () => {
        ["username", "email"].forEach((autoCompleteType) => {
          it(`has a ${autoCompleteType} 'autoCompleteType' value`, () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType,
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });
        });

        describe("does not have a parent form element", () => {
          beforeEach(() => {
            pageDetails.forms = {};
          });

          it("is structured on a page with a single visible password field", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "off",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });

          it("is structured on a page with a single non-visible password field", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "off",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              viewable: false,
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });

          it("has a non-disabled autoCompleteType and is structured on a page with no other password fields", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
            });

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });
        });

        describe("has a parent form element", () => {
          let form: MockProxy<AutofillForm>;

          beforeEach(() => {
            form = mock<AutofillForm>({ opid: "validFormId" });
            pageDetails.forms = {
              validFormId: form,
            };
          });

          it("is structured on a page with a single password field", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });

          it("is structured on a page with a with no visible password fields and a non-disabled autocomplete type", () => {
            const field = mock<AutofillField>({
              type: "text",
              autoCompleteType: "",
              htmlID: "user-username",
              htmlName: "user-username",
              placeholder: "user-username",
              form: "validFormId",
            });
            const passwordField = mock<AutofillField>({
              type: "password",
              autoCompleteType: "current-password",
              htmlID: "user-password",
              htmlName: "user-password",
              placeholder: "user-password",
              form: "validFormId",
              viewable: false,
            });
            pageDetails.fields = [field, passwordField];

            expect(
              inlineMenuFieldQualificationService.isFieldForLoginForm(field, pageDetails),
            ).toBe(true);
          });
        });
      });
    });
  });

  describe("isFieldForCreditCardForm", () => {
    describe("an invalid credit card field", () => {
      it("has reference to a `new field` keyword", () => {
        const field = mock<AutofillField>({
          placeholder: "new credit card",
        });

        expect(
          inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
        ).toBe(false);
      });

      describe("does not have a parent form", () => {
        it("has no credit card number fields in the page details", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
          });
          const secondField = mock<AutofillField>({
            placeholder: "card cvv",
            autoCompleteType: "cc-csc",
          });
          pageDetails.forms = {};
          pageDetails.fields = [field, secondField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(false);
        });

        it("has no credit card cvv fields in the page details", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
          });
          const secondField = mock<AutofillField>({
            placeholder: "card number",
            autoCompleteType: "cc-number",
          });
          pageDetails.forms = {};
          pageDetails.fields = [field, secondField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(false);
        });
      });

      describe("has a parent form", () => {
        let form: MockProxy<AutofillForm>;

        beforeEach(() => {
          form = mock<AutofillForm>({ opid: "validFormId" });
          pageDetails.forms = {
            validFormId: form,
          };
        });

        it("does not have a credit card number field within the same form", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
            form: "validFormId",
          });
          const cardCvvField = mock<AutofillField>({
            placeholder: "card cvv",
            autoCompleteType: "cc-csc",
            form: "validFormId",
          });
          pageDetails.fields = [field, cardCvvField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(false);
        });

        it("does not contain a cvv field within the same form", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
            form: "validFormId",
          });
          const cardNumberField = mock<AutofillField>({
            placeholder: "card number",
            autoCompleteType: "cc-number",
            form: "validFormId",
          });

          pageDetails.fields = [field, cardNumberField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(false);
        });
      });
    });

    describe("a valid credit card field", () => {
      describe("does not have a parent form", () => {
        it("is structured on a page with a single credit card number field and a single cvv field", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
          });
          const cardNumberField = mock<AutofillField>({
            placeholder: "card number",
            autoCompleteType: "cc-number",
          });
          const cardCvvField = mock<AutofillField>({
            placeholder: "card cvv",
            autoCompleteType: "cc-csc",
          });
          pageDetails.forms = {};
          pageDetails.fields = [field, cardNumberField, cardCvvField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(true);
        });
      });

      describe("has a parent form", () => {
        let form: MockProxy<AutofillForm>;

        beforeEach(() => {
          form = mock<AutofillForm>({ opid: "validFormId" });
          pageDetails.forms = {
            validFormId: form,
          };
        });

        it("has a credit card number field and cvv field structured within the same form", () => {
          const field = mock<AutofillField>({
            placeholder: "name",
            form: "validFormId",
          });
          const cardNumberField = mock<AutofillField>({
            placeholder: "card number",
            autoCompleteType: "cc-number",
            form: "validFormId",
          });
          const cardCvvField = mock<AutofillField>({
            placeholder: "card cvv",
            autoCompleteType: "cc-csc",
            form: "validFormId",
          });
          pageDetails.fields = [field, cardNumberField, cardCvvField];

          expect(
            inlineMenuFieldQualificationService.isFieldForCreditCardForm(field, pageDetails),
          ).toBe(true);
        });
      });
    });
  });

  describe("isFieldForAccountCreationForm", () => {
    it("validates a field for an account creation if the field is formless but at least one new password field exists in the page details", () => {
      const field = mock<AutofillField>({
        placeholder: "username",
        autoCompleteType: "username",
        type: "text",
        htmlName: "username",
        htmlID: "username",
      });
      const passwordField = mock<AutofillField>({
        placeholder: "new password",
        autoCompleteType: "new-password",
        type: "password",
        htmlName: "new-password",
        htmlID: "new-password",
      });
      pageDetails.forms = {};
      pageDetails.fields = [field, passwordField];

      expect(
        inlineMenuFieldQualificationService.isFieldForAccountCreationForm(field, pageDetails),
      ).toBe(true);
    });

    it("validates a field for an account creation if the field is formless and contains an account creation keyword", () => {
      const field = mock<AutofillField>({
        placeholder: "register username",
        autoCompleteType: "username",
        type: "text",
        htmlName: "username",
        htmlID: "username",
      });
      pageDetails.forms = {};
      pageDetails.fields = [field];

      expect(
        inlineMenuFieldQualificationService.isFieldForAccountCreationForm(field, pageDetails),
      ).toBe(true);
    });
  });

  describe("isFieldForIdentityUsername", () => {
    it("returns true if the field contains a keyword indicating that it is for a username field", () => {
      const field = mock<AutofillField>({
        placeholder: "user-name",
        autoCompleteType: "",
        type: "text",
        htmlName: "user-name",
        htmlID: "user-name",
      });

      expect(inlineMenuFieldQualificationService.isFieldForIdentityUsername(field)).toBe(true);
    });
  });

  describe("isEmailField", () => {
    it("returns true if the field type is of `email`", () => {
      const field = mock<AutofillField>({
        placeholder: "email",
        autoCompleteType: "",
        type: "email",
        htmlName: "email",
        htmlID: "email",
      });

      expect(inlineMenuFieldQualificationService.isEmailField(field)).toBe(true);
    });
  });
});
