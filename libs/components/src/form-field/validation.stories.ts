import { Component, OnInit, input } from "@angular/core";
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { action } from "storybook/actions";
import { userEvent, getByText } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { AsyncActionsModule } from "../async-actions";
import { ButtonModule } from "../button";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { trimValidator, forbiddenCharacters } from "./bit-validators";
import { FormFieldModule } from "./form-field.module";

// --- Example validators ---------------------------------------------------
// These live in the story file because they exist to illustrate the docs.
// Real validators belong next to the form/feature that uses them, or in
// `libs/components/src/form-field/bit-validators` when broadly reusable.

/**
 * Synchronous validator against pre-fetched data.
 *
 * The list of claimed domains is loaded once (e.g. when the dialog opens) and
 * closed over by the validator, so validation itself stays synchronous.
 */
function claimedDomainValidator(claimedDomains: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? "";
    const domain = value.split("@")[1]?.toLowerCase();
    if (!domain) {
      return null;
    }
    if (!claimedDomains.includes(domain)) {
      return {
        unclaimedDomain: {
          message: `Email must belong to a claimed domain: ${claimedDomains.join(", ")}`,
        },
      };
    }
    return null;
  };
}

/**
 * Asynchronous validator (here, a server lookup).
 *
 * Returning a Promise lets Angular set the control to `pending` while the
 * lookup runs. Angular discards the result of a superseded run automatically,
 * so a fast-clicking user never sees a stale answer.
 */
function emailNotTakenValidator(): AsyncValidatorFn {
  // Stands in for an HTTP call to a dedicated validation endpoint.
  const lookupTakenEmail = (email: string): Promise<boolean> =>
    new Promise((resolve) => {
      const taken = ["taken@example.com", "admin@example.com"];
      setTimeout(() => resolve(taken.includes(email.toLowerCase())), 1000);
    });

  return async (control: AbstractControl): Promise<ValidationErrors | null> => {
    const value: string = control.value ?? "";
    if (value === "") {
      return null;
    }
    const taken = await lookupTakenEmail(value);
    return taken ? { emailTaken: { message: "This email address is already in use." } } : null;
  };
}

/**
 * A failure the server reports at submit time.
 *
 * The handler maps a known, field-attributable failure onto the control inline
 * (no toast), and rethrows anything it can't attribute so `bitSubmit` falls back
 * to the danger toast.
 */
class EmailTakenError extends Error {}

// Stands in for a POST whose server-side validation can fail after the client validated.
const createMember = (email: string): Promise<void> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      const value = email.toLowerCase();
      if (value === "taken@example.com") {
        reject(new EmailTakenError());
      } else if (value === "error@example.com") {
        reject(new Error("Simulated unexpected server error"));
      } else {
        resolve();
      }
    }, 1000);
  });

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-server-error-example",
  imports: [AsyncActionsModule, ButtonModule, FormFieldModule, InputModule, ReactiveFormsModule],
  template: /*html*/ `
    <form [formGroup]="formObj" [bitSubmit]="submit">
      <bit-form-field>
        <bit-label>Email</bit-label>
        <input bitInput type="email" formControlName="email" />
        <bit-hint>
          "taken@example.com" fails inline; "error@example.com" triggers the toast fallback (see the
          Actions panel); anything else succeeds.
        </bit-hint>
      </bit-form-field>

      <button type="submit" bitButton bitFormButton buttonType="primary">Submit</button>
      <bit-error-summary [formGroup]="formObj"></bit-error-summary>
    </form>
  `,
})
class ServerErrorExampleComponent implements OnInit {
  readonly initialEmail = input("");

  formObj = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
  });

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit() {
    this.formObj.controls.email.setValue(this.initialEmail());
  }

  submit = async () => {
    this.formObj.markAllAsTouched();
    if (!this.formObj.valid) {
      return;
    }

    const email = this.formObj.controls.email;
    try {
      await createMember(email.value ?? "");
    } catch (e) {
      // Known, field-attributable failure → render it inline like any other error.
      if (e instanceof EmailTakenError) {
        email.setErrors({ serverError: { message: "This email address is already in use." } });
        email.markAsTouched();
        return;
      }
      // Truly unexpected (infra, bug) → rethrow and let bitSubmit show the danger toast.
      throw e;
    }
  };
}

export default {
  title: "Component Library/Form/Validation",
  decorators: [
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        AsyncActionsModule,
        ServerErrorExampleComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              required: "required",
              loading: "Loading",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email address.",
              inputForbiddenCharacters: (char) =>
                `The following characters are not allowed: ${char}`,
              inputMinValue: (min) => `Input value must be at least ${min}.`,
              inputMaxValue: (max) => `Input value must not exceed ${max}.`,
              inputMinLength: (min) => `Input value must be at least ${min} characters long.`,
              inputMaxLength: (max) => `Input value must not exceed ${max} characters in length.`,
              inputTrimValidator: "Input must not contain only whitespace.",
              fieldsNeedAttention: "__$1__ field(s) above need your attention.",
            });
          },
        },
        {
          // bitSubmit routes any uncaught error here; in the app this shows the danger toast.
          provide: ValidationService,
          useValue: {
            showError: action("ValidationService.showError (danger toast fallback)"),
          } as Partial<ValidationService>,
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

const fb = new FormBuilder();

type Story = StoryObj;

// --- Built-in and shared validators ---------------------------------------

const showValidationsFormObj = fb.group({
  required: ["", [Validators.required]],
  whitespace: ["    ", trimValidator],
  email: ["example?bad-email", [Validators.email]],
  minLength: ["Hello", [Validators.minLength(8)]],
  maxLength: ["Hello there", [Validators.maxLength(8)]],
  minValue: [9, [Validators.min(10)]],
  maxValue: [15, [Validators.max(10)]],
  forbiddenChars: ["Th!$ value cont#in$ forbidden char$", forbiddenCharacters(["#", "!", "$"])],
});

export const Validations: Story = {
  render: (args) => ({
    props: {
      formObj: showValidationsFormObj,
      submit: () => showValidationsFormObj.markAllAsTouched(),
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Required validation</bit-label>
          <input bitInput formControlName="required" />
          <bit-hint>This field is required. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Email validation</bit-label>
          <input bitInput type="email" formControlName="email" />
          <bit-hint>This field contains a malformed email address. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Min length validation</bit-label>
          <input bitInput formControlName="minLength" />
          <bit-hint>Value must be at least 8 characters. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Max length validation</bit-label>
          <input bitInput formControlName="maxLength" />
          <bit-hint>Value must be less then 8 characters. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Min number value validation</bit-label>
          <input
            bitInput
            type="number"
            formControlName="minValue"
          />
          <bit-hint>Value must be greater than 10. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Max number value validation</bit-label>
          <input
            bitInput
            type="number"
            formControlName="maxValue"
          />
          <bit-hint>Value must be less than than 10. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Forbidden characters validation</bit-label>
          <input
            bitInput
            formControlName="forbiddenChars"
          />
          <bit-hint>Value must not contain '#', '!' or '$'. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <bit-form-field>
          <bit-label>White space validation</bit-label>
          <input bitInput formControlName="whitespace" />
          <bit-hint>This input contains only white space. Submit form or blur input to see error</bit-hint>
        </bit-form-field>

        <button type="submit" bitButton buttonType="primary">Submit</button>
        <bit-error-summary [formGroup]="formObj"></bit-error-summary>
      </form>
    `,
  }),
  play: async (context) => {
    const canvas = context.canvasElement;
    const submitButton = getByText(canvas, "Submit");

    await userEvent.click(submitButton);
  },
};

// --- Custom synchronous validator (validates against pre-fetched data) ----

const preFetchedFormObj = fb.group({
  email: ["member@unclaimed.com", [Validators.required, claimedDomainValidator(["example.com"])]],
});

export const PreFetchedData: Story = {
  render: () => ({
    props: {
      formObj: preFetchedFormObj,
      submit: () => preFetchedFormObj.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Member email</bit-label>
          <input bitInput type="email" formControlName="email" />
          <bit-hint>Only the claimed domain "example.com" is allowed. Blur the field or submit to see the error.</bit-hint>
        </bit-form-field>

        <button type="submit" bitButton buttonType="primary">Submit</button>
        <bit-error-summary [formGroup]="formObj"></bit-error-summary>
      </form>
    `,
  }),
};

// --- Asynchronous validator -----------------------------------------------

const asyncFormObj = fb.group({
  email: [
    "",
    {
      // Run the (potentially expensive) async check on blur, not on every keystroke.
      updateOn: "blur",
      validators: [Validators.required, Validators.email],
      asyncValidators: [emailNotTakenValidator()],
    },
  ],
});

export const AsyncValidation: Story = {
  render: () => ({
    props: {
      formObj: asyncFormObj,
      submit: () => asyncFormObj.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Email</bit-label>
          <input bitInput type="email" formControlName="email" />
          @if (formObj.controls.email.pending) {
            <bit-hint><i class="bwi bwi-spinner bwi-spin" aria-hidden="true"></i> Checking availability&hellip;</bit-hint>
          } @else {
            <bit-hint>Try "taken@example.com" or "admin@example.com". Blur the field to run the check.</bit-hint>
          }
        </bit-form-field>

        <button type="submit" bitButton buttonType="primary">Submit</button>
        <bit-error-summary [formGroup]="formObj"></bit-error-summary>
      </form>
    `,
  }),
};

// --- Server error mapped inline at submit ---------------------------------

// Attributable failure → mapped onto the control inline. Submit to see it.
export const ServerErrorInline: Story = {
  render: () => ({
    template: `<app-server-error-example initialEmail="taken@example.com"></app-server-error-example>`,
  }),
};
