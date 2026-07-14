import { TextFieldModule } from "@angular/cdk/text-field";
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

import { A11yTitleDirective } from "../a11y/a11y-title.directive";
import { AsyncActionsModule } from "../async-actions";
import { BadgeModule } from "../badge";
import { ButtonModule } from "../button";
import { CardComponent } from "../card";
import { CheckboxModule } from "../checkbox";
import { IconComponent } from "../icon";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input/input.module";
import { LinkModule } from "../link";
import { RadioButtonModule } from "../radio-button";
import { SectionComponent } from "../section";
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
        A11yTitleDirective,
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        IconComponent,
        IconButtonModule,
        AsyncActionsModule,
        CheckboxModule,
        RadioButtonModule,
        SelectModule,
        LinkModule,
        CardComponent,
        SectionComponent,
        TextFieldModule,
        BadgeModule,
        A11yTitleDirective,
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
              toggleVisibility: "Toggle visibility",
              loading: "Loading",
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

const fb = new UntypedFormBuilder();
const formObj = fb.group({
  test: [""],
  required: ["", [Validators.required]],
  amount: [null],
});

const defaultFormObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email, forbiddenNameValidator(/bit/i)]],
  terms: [false, [Validators.requiredTrue]],
  updates: ["yes"],
  file: [""],
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
      formObj: formObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>Label</bit-label>
          <input bitInput formControlName="test" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const InteractionStates: Story = {
  render: (args) => ({
    props: { formObj: formObj, ...args },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>Default</bit-label>
          <input bitInput formControlName="test" />
        </bit-form-field>

        <bit-form-field id="hover-field">
          <bit-label>Hover</bit-label>
          <input bitInput formControlName="test" />
        </bit-form-field>

        <bit-form-field id="focus-field">
          <bit-label>Focus</bit-label>
          <input bitInput formControlName="test" />
        </bit-form-field>

        <bit-form-field id="hover-focus-field">
          <bit-label>Hover + Focus</bit-label>
          <input bitInput formControlName="test" />
        </bit-form-field>
      </form>
    `,
  }),
  play: async ({ canvasElement }) => {
    const getContainer = (id: string) => canvasElement.querySelector(`#${id} [bitfieldcontainer]`);

    getContainer("hover-field")?.classList.add("tw-test-hover");
    getContainer("focus-field")?.querySelector("input")?.classList.add("tw-test-focus-visible");

    const hoverFocus = getContainer("hover-focus-field");
    hoverFocus?.classList.add("tw-test-hover");
    hoverFocus?.querySelector("input")?.classList.add("tw-test-focus-visible");
  },
};

export const Large: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field size="large" [formGroup]="formObj">
          <bit-label>Label</bit-label>
          <input required formControlName="required" bitInput placeholder="Placeholder" />
          <span bitPrefix>$</span>
          <span bitSuffix>USD</span>
      </bit-form-field>
      </form>
    `,
  }),
};

export const LabelWithIcon: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>
            Label
            <a href="#" slot="end" bitLink startIcon="bwi-question-circle" aria-label="More info" title="More info">
            </a>
          </bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const LongLabel: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" style="width: 200px">
        <bit-form-field>
          <bit-label>
            Hello I am a very long label with lots of very cool helpful information
          </bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
        <bit-form-field>
          <bit-label>
            Hello I am a very long label with lots of very cool helpful information
            <a href="#" slot="end" bitLink startIcon="bwi-question-circle" aria-label="More info" title="More info">
            </a>
          </bit-label>
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
    template: /*html*/ `
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
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>FormControl</bit-label>
        <input bitInput formControlName="required" placeholder="Placeholder" />
        <bit-hint>Long hint text</bit-hint>
      </bit-form-field>
    `,
  }),
};

export const Inactive: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
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
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Input</bit-label>
        <input bitInput value="Foobar" readonly />
      </bit-form-field>

      <bit-form-field>
        <bit-label>Input</bit-label>
        <input bitInput type="password" value="Foobar" [readonly]="true" />
        <button type="button" label="Toggle password" bitIconButton bitSuffix bitPasswordInputToggle></button>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Input"></button>
      </bit-form-field>

      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4" readonly>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</textarea>
      </bit-form-field>

       <bit-form-field>
        <bit-label>Textarea short</bit-label>
        <textarea bitInput rows="1" readonly>Lorem ipsum dolor sit ametroident</textarea>
      </bit-form-field>

      <div class="tw-p-4 tw-mt-10 tw-border-2 tw-border-solid tw-border-black tw-bg-background-alt">
        <h2 bitTypography="h2">Inside card</h2>
        <bit-section>
          <bit-card>
            <bit-form-field>
              <bit-label>Input</bit-label>
              <input bitInput value="Foobar" readonly />
            </bit-form-field>

            <bit-form-field>
              <bit-label>Input</bit-label>
              <input bitInput type="password" value="Foobar" readonly />
              <button type="button" bitIconButton bitSuffix bitPasswordInputToggle></button>
              <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Input"></button>
            </bit-form-field>

            <bit-form-field>
              <bit-label>Textarea <span slot="end" bitBadge variant="success">Premium</span></bit-label>
              <textarea bitInput rows="3" readonly class="tw-resize-none">Row1
Row2
Row3</textarea>
            </bit-form-field>

            <bit-form-field disableMargin>
              <bit-label>Sans margin</bit-label>
              <input bitInput value="Foobar" readonly />
            </bit-form-field>
          </bit-card>
        </bit-section>
      </div>
    `,
  }),
  args: {},
};

export const InputGroup: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Label</bit-label>
        <input required formControlName="required" bitInput placeholder="Placeholder" />
        <span bitPrefix>$</span>
        <span bitSuffix>USD</span>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const InlineEndButton: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Allowed domains</bit-label>
        <input bitInput formControlName="test" placeholder="example.com" />
        <bit-hint>Comma-separated list of email domains.</bit-hint>
        <button type="button" bitButton buttonType="primary" slot="inline-end">
          Save
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const ButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>
          Label
          <a href="#" slot="end" startIcon="bwi-question-circle" bitLink [appA11yTitle]="'More info'">
          </a>
        </bit-label>
        <bit-icon bitPrefix name="bwi-star" label="Favorite Label"></bit-icon>
        <input bitInput placeholder="Placeholder" />
        <button type="button" bitSuffix bitIconButton="bwi-eye" label="Hide Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-ellipsis-v" label="Menu Label"></button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const DangerButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" />
        <button type="button" bitSuffix bitIconButton="bwi-minus-circle" buttonType="dangerGhost" label="Remove"></button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const InactiveButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <button type="button" bitPrefix bitIconButton="bwi-star" disabled label="Favorite Label"></button>
        <input bitInput placeholder="Placeholder" disabled />
        <button type="button" bitSuffix bitIconButton="bwi-eye" disabled label="Hide Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-clone" disabled label="Clone Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-ellipsis-v" disabled label="Menu Label"></button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const PartiallyInactiveButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" disabled />
        <button type="button" bitSuffix bitIconButton="bwi-eye" label="Hide Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Label"></button>
        <button type="button" bitSuffix bitIconButton="bwi-ellipsis-v" disabled label="Menu Label"></button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Select: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
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
  render: (args) => ({
    props: {
      formObj: fb.group({
        select: "",
      }),
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Label</bit-label>
        <bit-select formControlName="select">
          <bit-option label="Option 1" value="value1"></bit-option>
          <bit-option label="Option 2" value="value2"></bit-option>
        </bit-select>
      </bit-form-field>
    `,
  }),
};

export const LargeAdvancedSelect: Story = {
  render: (args) => ({
    props: {
      formObj: fb.group({
        select: "",
      }),
      ...args,
    },
    template: /*html*/ `
      <bit-form-field size="large" [formGroup]="formObj">
        <bit-label>Label</bit-label>
        <bit-select formControlName="select">
          <bit-option label="Option 1" value="value1"></bit-option>
          <bit-option label="Option 2" value="value2"></bit-option>
        </bit-select>
      </bit-form-field>
    `,
  }),
};

export const FileInput: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>File</bit-label>
          <div class="tw-text-main tw-flex tw-items-center tw-h-full tw-gap-2">
            <button bitButton size="small" type="button" buttonType="secondary">
              Choose File
            </button>
            No file chosen
          </div>
          <input
            bitInput
            #fileSelector
            type="file"
            formControlName="file"
            hidden
          />
        </bit-form-field>
      </form>
    `,
  }),
};

export const NumberInput: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Amount</bit-label>
        <input bitInput type="number" formControlName="amount" placeholder="0" />
        <span bitSuffix>USD</span>
        <bit-hint>Enter a numeric value.</bit-hint>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const DateInput: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Date</bit-label>
        <input bitInput type="date" formControlName="test" />
        <bit-hint>Select a date</bit-hint>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Textarea: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</textarea>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Label"></button>
        <bit-hint>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</bit-hint>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Textarea disabled</bit-label>
        <textarea bitInput rows="4" disabled>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</textarea>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Label"></button>
        <bit-hint>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</bit-hint>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Textarea readonly</bit-label>
        <textarea bitInput rows="4" readonly>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</textarea>
        <button type="button" bitSuffix bitIconButton="bwi-clone" label="Clone Label"></button>
        <bit-hint>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</bit-hint>
      </bit-form-field>
    `,
  }),
  args: {},
};
