import { Component, Input } from "@angular/core";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
  FormControl,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/src/platform/abstractions/i18n.service";

import { FormControlModule } from "../form-control";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CheckboxModule } from "./checkbox.module";

const template = `
  <form [formGroup]="formObj">
    <bit-form-control>
      <input type="checkbox" bitCheckbox formControlName="checkbox" />
      <bit-label>Click me</bit-label>
    </bit-form-control>
  </form>
`;

@Component({
  selector: "app-example",
  template,
})
class ExampleComponent {
  protected formObj = this.formBuilder.group({
    checkbox: [false, Validators.requiredTrue],
  });

  @Input() set checked(value: boolean) {
    this.formObj.patchValue({ checkbox: value });
  }

  @Input() set disabled(disable: boolean) {
    if (disable) {
      this.formObj.disable();
    } else {
      this.formObj.enable();
    }
  }

  constructor(private formBuilder: FormBuilder) {}
}

export default {
  title: "Component Library/Form/Checkbox",
  decorators: [
    moduleMetadata({
      declarations: [ExampleComponent],
      imports: [FormsModule, ReactiveFormsModule, FormControlModule, CheckboxModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
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
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=3930%3A16850&t=xXPx6GJYsJfuMQPE-4",
    },
  },
} as Meta;

type Story = StoryObj<ExampleComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `<app-example [checked]="checked" [disabled]="disabled"></app-example>`,
  }),
  parameters: {
    docs: {
      source: {
        code: template,
      },
    },
  },
  args: {
    checked: false,
    disabled: false,
  },
};

export const Hint: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        checkbox: new FormControl(false),
      }),
    },
    template: `
      <form [formGroup]="formObj">
        <bit-form-control>
          <input type="checkbox" bitCheckbox formControlName="checkbox" />
          <bit-label>Really long value that never ends.</bit-label>
          <bit-hint>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur iaculis consequat enim vitae elementum.
            Ut non odio est. Duis eu nisi ultrices, porttitor lorem eget, ornare libero. Fusce ex ante, consequat ac
            sem et, euismod placerat tellus.
          </bit-hint>
        </bit-form-control>
      </form>
    `,
  }),
  parameters: {
    docs: {
      source: {
        code: template,
      },
    },
  },
  args: {
    checked: false,
    disabled: false,
  },
};

export const Custom: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-w-32">
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2 tw-items-baseline">
          A-Z
          <input class="tw-ml-auto focus-visible:tw-ring-offset-secondary-300" type="checkbox" bitCheckbox />
        </label>
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2 tw-items-baseline">
          a-z
          <input class="tw-ml-auto focus-visible:tw-ring-offset-secondary-300" type="checkbox" bitCheckbox />
        </label>
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2 tw-items-baseline">
          0-9
          <input class="tw-ml-auto focus-visible:tw-ring-offset-secondary-300" type="checkbox" bitCheckbox />
        </label>
      </div>
    `,
  }),
};

export const Indeterminate: Story = {
  render: (args) => ({
    props: args,
    template: `
      <input type="checkbox" bitCheckbox [indeterminate]="true">
    `,
  }),
};
