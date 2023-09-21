import {
  AbstractControl,
  UntypedFormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AsyncActionsModule } from "../async-actions";
import { ButtonModule } from "../button";
import { CheckboxModule } from "../checkbox";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input/input.module";
import { RadioButtonModule } from "../radio-button";
import { SelectModule } from "../select";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BitFormFieldComponent } from "./form-field.component";
import { FormFieldModule } from "./form-field.module";

export default {
  title: "Component Library/Form/Field",
  component: BitFormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        IconButtonModule,
        AsyncActionsModule,
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
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
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

const fb = new UntypedFormBuilder();
const formObj = fb.group({
  test: [""],
  required: ["", [Validators.required]],
});

const defaultFormObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email, forbiddenNameValidator(/bit/i)]],
  terms: [false, [Validators.requiredTrue]],
  updates: ["yes"],
});

// Custom error message, `message` is shown as the error message
function forbiddenNameValidator(nameRe: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const forbidden = nameRe.test(control.value);
    return forbidden ? { forbiddenName: { message: "forbiddenName" } } : null;
  };
}

function submit() {
  defaultFormObj.markAllAsTouched();
}
type Story = StoryObj<BitFormFieldComponent>;

export const Default: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>Label</bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const Required: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput required placeholder="Placeholder" />
      </bit-form-field>
  
      <bit-form-field [formGroup]="formObj">
        <bit-label>FormControl</bit-label>
        <input bitInput formControlName="required" placeholder="Placeholder" />
      </bit-form-field>
    `,
  }),
};

export const Hint: Story = {
  render: (args: BitFormFieldComponent) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: `
      <bit-form-field [formGroup]="formObj">
        <bit-label>FormControl</bit-label>
        <input bitInput formControlName="required" placeholder="Placeholder" />
        <bit-hint>Long hint text</bit-hint>
      </bit-form-field>
    `,
  }),
};

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" disabled />
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Readonly: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Input</bit-label>
        <input bitInput value="Foobar" readonly />
      </bit-form-field>

      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4" readonly>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</textarea>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const InputGroup: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" />
        <span bitPrefix>$</span>
        <span bitSuffix>USD</span>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const ButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-form-field>
        <button bitPrefix bitIconButton="bwi-star"></button>
        <input bitInput placeholder="Placeholder" />
        <button bitSuffix bitIconButton="bwi-eye"></button>
        <button bitSuffix bitIconButton="bwi-clone"></button>
        <button bitSuffix bitButton>
          Apply
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const DisabledButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <button bitPrefix bitIconButton="bwi-star" disabled></button>
        <input bitInput placeholder="Placeholder" disabled />
        <button bitSuffix bitIconButton="bwi-eye" disabled></button>
        <button bitSuffix bitIconButton="bwi-clone" disabled></button>
        <button bitSuffix bitButton disabled>
          Apply
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Select: Story = {
  render: (args: BitFormFieldComponent) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <select bitInput>
          <option>Select</option>
          <option>Other</option>
        </select>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const AdvancedSelect: Story = {
  render: (args: BitFormFieldComponent) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <bit-select>
          <bit-option label="Select"></bit-option>
          <bit-option label="Other"></bit-option>
        </bit-select>
      </bit-form-field>
    `,
  }),
};

export const Textarea: Story = {
  render: (args: BitFormFieldComponent) => ({
    props: args,
    template: `
      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4"></textarea>
      </bit-form-field>
    `,
  }),
  args: {},
};
