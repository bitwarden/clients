import {
  // AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  // ValidationErrors,
  // ValidatorFn,
  Validators,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { CheckboxModule } from "../checkbox";
import { FormControlModule } from "../form-control";
import { FormFieldModule } from "../form-field";
import { trimValidator, forbiddenCharacters } from "../form-field/bit-validators";
import { InputModule } from "../input/input.module";
import { MultiSelectModule } from "../multi-select";
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
        MultiSelectModule,
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
              inputForbiddenCharacters: (char) => `Input value must not contain "${char}"`,
              inputMinValue: (min) => `Input value must be at least ${min}.`,
              inputMaxValue: (max) => `Input value must not exceed ${max}.`,
              inputMinLength: (min) => `Input value must be at least ${min} characters.`,
              inputMaxLength: (max) => `Input value must not exceed ${max} characters.`,
              inputTrimValidator: `The input value must not contain only whitespace`,
              multiSelectPlaceholder: "-- Type to Filter --",
              multiSelectLoading: "Retrieving options...",
              multiSelectNotFound: "No items found",
              multiSelectClearAll: "Clear all",
            });
          },
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
const exampleFormObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email, forbiddenCharacters(["#"])]],
  country: [undefined as string | undefined, [Validators.required]],
  groups: [],
  terms: [false, [Validators.requiredTrue]],
  updates: ["yes"],
  age: [null, [Validators.min(0), Validators.max(150)]],
});

// Custom error message, `message` is shown as the error message
// function forbiddenNameValidator(nameRe: RegExp): ValidatorFn {
//   return (control: AbstractControl): ValidationErrors | null => {
//     const forbidden = nameRe.test(control.value);
//     return forbidden ? { forbiddenName: { message: "forbiddenName" } } : null;
//   };
// }

type Story = StoryObj;

const requiredNameForm = fb.group({
  name: ["", [Validators.required]],
});

export const RequiredField: Story = {
  render: (args) => ({
    props: {
      formObj: requiredNameForm,
      submit: () => requiredNameForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input bitInput formControlName="name" />
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const emailForm = fb.group({
  email: ["", [Validators.required, Validators.email]],
});

export const InvalidEmail: Story = {
  render: (args) => ({
    props: {
      formObj: emailForm,
      submit: () => emailForm.markAllAsTouched(),
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Email</bit-label>
          <input bitInput type="email" formControlName="email" />
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const minLengthForm = fb.group({
  name: ["Hello", [Validators.minLength(8)]],
});

export const MinStringLength: Story = {
  render: (args) => ({
    props: {
      formObj: minLengthForm,
      submit: () => minLengthForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Value must be at least 8 characters. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const maxLengthForm = fb.group({
  name: ["Hello there", [Validators.maxLength(8)]],
});

export const MaxStringLength: Story = {
  render: (args) => ({
    props: {
      formObj: maxLengthForm,
      submit: () => maxLengthForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Value must be less then 8 characters. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const minNumberForm = fb.group({
  age: [9, [Validators.min(10)]],
});

export const MinNumberValue: Story = {
  render: (args) => ({
    props: {
      formObj: minNumberForm,
      submit: () => minNumberForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Age</bit-label>
          <input
            bitInput
            type="number"
            formControlName="age"
          />
          <bit-hint>Value must be greater than 10. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const maxNumberForm = fb.group({
  age: [11, [Validators.max(10)]],
});

export const MaxNumberValue: Story = {
  render: (args) => ({
    props: {
      formObj: maxNumberForm,
      submit: () => maxNumberForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Age</bit-label>
          <input
            bitInput
            type="number"
            formControlName="age"
          />
          <bit-hint>Value must be less than than 10. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const forbiddenCharsForm = fb.group({
  email: ["example!@#bitwarden.com", forbiddenCharacters(["#", "!"])],
});

export const ForbiddenCharacters: Story = {
  render: (args) => ({
    props: {
      formObj: forbiddenCharsForm,
      submit: () => forbiddenCharsForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Email</bit-label>
          <input
            bitInput
            type="email"
            formControlName="email"
          />
          <bit-hint>Value must not contain '#' or '!'. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

const whiteSpaceOnlyForm = fb.group({
  name: ["    ", trimValidator],
});

export const NoWhiteSpaceOnly: Story = {
  render: (args) => ({
    props: {
      formObj: whiteSpaceOnlyForm,
      submit: () => whiteSpaceOnlyForm.markAllAsTouched(),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input
            bitInput
            formControlName="name"
          />
          <bit-hint>This input contains only white space. Submit to see error</bit-hint>
        </bit-form-field>
        <button type="submit" bitButton buttonType="primary">Submit</button>
      </form>
    `,
  }),
};

export const FullExample: Story = {
  render: (args) => ({
    props: {
      formObj: exampleFormObj,
      submit: () => exampleFormObj.markAllAsTouched(),
      ...args,
    },
    template: /*html*/ `
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
          <bit-label>Groups</bit-label>
          <bit-multi-select
            class="tw-w-full"
            formControlName="groups"
            [baseItems]="baseItems"
            [removeSelectedItems]="removeSelectedItems"
            [loading]="false"
            [disabled]="false"
            (onItemsConfirmed)="onItemsConfirmed($event)">
          </bit-multi-select>
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
    baseItems: [
      { id: "1", listName: "Group 1", labelName: "Group 1", icon: "bwi-family" },
      { id: "2", listName: "Group 2", labelName: "Group 2", icon: "bwi-family" },
      { id: "3", listName: "Group 3", labelName: "Group 3", icon: "bwi-family" },
      { id: "4", listName: "Group 4", labelName: "Group 4", icon: "bwi-family" },
      { id: "5", listName: "Group 5", labelName: "Group 5", icon: "bwi-family" },
      { id: "6", listName: "Group 6", labelName: "Group 6", icon: "bwi-family" },
      { id: "7", listName: "Group 7", labelName: "Group 7", icon: "bwi-family" },
    ],
  },
};
