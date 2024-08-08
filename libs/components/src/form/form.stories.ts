import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { CheckboxModule } from "../checkbox";
import { FormControlModule } from "../form-control";
import { FormFieldModule } from "../form-field";
import { InputModule } from "../input/input.module";
import { RadioButtonModule } from "../radio-button";
import { SelectModule } from "../select";
import { I18nMockService } from "../utils/i18n-mock.service";

import { countries } from "./countries";

export default {
  title: "Component Library/Form",
  decorators: [
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        FormControlModule,
        CheckboxModule,
        RadioButtonModule,
        SelectModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              selectPlaceholder: "-- Select --",
              required: "required",
              checkboxRequired: "Option is required",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
              inputMinValue: (min) => `Input value must be at least ${min}.`,
              inputMaxValue: (max) => `Input value must not exceed ${max}.`,
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A17689",
    },
  },
} as Meta;

const fb = new FormBuilder();
const exampleFormObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email, forbiddenNameValidator(/bit/i)]],
  country: [undefined as string | undefined, [Validators.required]],
  terms: [false, [Validators.requiredTrue]],
  updates: ["yes"],
  age: [null, [Validators.min(0), Validators.max(150)]],
});

// Custom error message, `message` is shown as the error message
function forbiddenNameValidator(nameRe: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const forbidden = nameRe.test(control.value);
    return forbidden ? { forbiddenName: { message: "forbiddenName" } } : null;
  };
}

type Story = StoryObj;

export const FullExample: Story = {
  render: (args) => ({
    props: {
      formObj: exampleFormObj,
      submit: () => exampleFormObj.markAllAsTouched(),
      ...args,
    },
    template: `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input bitInput formControlName="name" />
        </bit-form-field>

        <bit-form-field>
          <bit-label>Email</bit-label>
          <input bitInput formControlName="email" />
        </bit-form-field>

        <bit-form-field>
          <bit-label>Country</bit-label>
          <bit-select formControlName="country">
            <bit-option *ngFor="let country of countries" [value]="country.value" [label]="country.name"></bit-option>
          </bit-select>
        </bit-form-field>

        <bit-form-field>
          <bit-label>Age</bit-label>
          <input
            bitInput
            type="number"
            formControlName="age"
            min="0"
            max="150"
          />
        </bit-form-field>

        <bit-form-control>
          <bit-label>Agree to terms</bit-label>
          <input type="checkbox" bitCheckbox formControlName="terms" />
          <bit-hint>Required for the service to work properly</bit-hint>
        </bit-form-control>

        <bit-radio-group formControlName="updates">
          <bit-label>Subscribe to updates?</bit-label>
          <bit-radio-button value="yes">
            <bit-label>Yes</bit-label>
          </bit-radio-button>
          <bit-radio-button value="no">
            <bit-label>No</bit-label>
          </bit-radio-button>
          <bit-radio-button value="later">
            <bit-label>Decide later</bit-label>
          </bit-radio-button>
        </bit-radio-group>

        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),

  args: {
    countries,
  },
};
