import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { userEvent, getByText } from "storybook/test";

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
              inputEmail: "Input is not an email address.",
              inputForbiddenCharacters: (char) =>
                `The following characters are not allowed: "${char}"`,
              inputMinValue: (min) => `Input value must be at least ${min}.`,
              inputMaxValue: (max) => `Input value must not exceed ${max}.`,
              inputMinLength: (min) => `Input value must be at least ${min} characters long.`,
              inputMaxLength: (max) => `Input value must not exceed ${max} characters in length.`,
              inputTrimValidator: `Input must not contain only whitespace.`,
              multiSelectPlaceholder: "-- Type to Filter --",
              multiSelectLoading: "Retrieving options...",
              multiSelectNotFound: "No items found",
              multiSelectClearAll: "Clear all",
              fieldsNeedAttention: "__$1__ field(s) above need your attention.",
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

type Story = StoryObj;

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
