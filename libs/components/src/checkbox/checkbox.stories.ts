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
import { TableModule } from "../table";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CheckboxModule } from "./checkbox.module";

const template = /*html*/ `
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
      imports: [FormsModule, ReactiveFormsModule, FormControlModule, CheckboxModule, TableModule],
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
    template: /*html*/ `
      <app-example></app-example>
      <app-example [checked]="true"></app-example>
    `,
  }),
  parameters: {
    docs: {
      source: {
        code: template,
      },
    },
  },
};

export const LongLabel: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        checkbox: new FormControl(false),
      }),
    },
    template: /*html*/ `
      <form [formGroup]="formObj" class="tw-w-96">
        <bit-form-control>
          <input type="checkbox" bitCheckbox formControlName="checkbox">
          <bit-label>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur iaculis consequat enim vitae elementum.
            Ut non odio est. </bit-label>
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
};

export const Hint: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        checkbox: new FormControl(false),
      }),
    },
    template: /*html*/ `
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

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <app-example [disabled]="true"></app-example>
      <app-example [checked]="true" [disabled]="true"></app-example>
    `,
  }),
  parameters: {
    docs: {
      source: {
        code: template,
      },
    },
  },
};

export const Custom: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-w-32">
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2">
          A-Z
          <input class="tw-ml-auto focus-visible:tw-ring-offset-secondary-300" type="checkbox" bitCheckbox />
        </label>
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2">
          a-z
          <input class="tw-ml-auto focus-visible:tw-ring-offset-secondary-300" type="checkbox" bitCheckbox />
        </label>
        <label class="tw-text-main tw-flex tw-bg-secondary-300 tw-p-2">
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
    template: /*html*/ `
      <input type="checkbox" bitCheckbox [indeterminate]="true">
    `,
  }),
};

export const InTableRow: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-table>
        <ng-container header>
          <tr>
            <th bitCell>
              <input
                type="checkbox"
                bitCheckbox
                id="checkAll"
                class="tw-mr-2"
              />
              <label for="checkAll" class="tw-mb-0">
                All
              </label>
            </th>
            <th bitCell>
              Foo
            </th>
            <th bitCell>
              Bar
            </th>
          </tr>
        </ng-container>
        <ng-template body>
          <tr bitRow>
            <td bitCell>
              <input
                type="checkbox"
                bitCheckbox
                id="checkOne"
              />
            </td>
            <td bitCell>Lorem</td>
            <td bitCell>Ipsum</td>
          </tr>
        </ng-template>
      </bit-table>
    `,
  }),
};
