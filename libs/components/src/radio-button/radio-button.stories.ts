import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormControlCardComponent } from "../form-control/form-control-card.component";
import { FormControlGroupComponent } from "../form-control/form-control-group.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { RadioButtonModule } from "./radio-button.module";
import { RadioInputComponent } from "./radio-input.component";

export default {
  title: "Component Library/Form/Radio Button",
  component: FormControlGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        RadioButtonModule,
        FormControlCardComponent,
        RadioInputComponent,
      ],
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
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-35836&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta<FormControlGroupComponent>;

type Story = StoryObj<FormControlGroupComponent>;

export const Inline: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>First</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Second</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Third</bit-label>
          </bit-form-control>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const InlineHint: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>First</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Second</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Third</bit-label>
          </bit-form-control>

          <bit-hint>This is a hint for the radio group</bit-hint>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const Block: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio" [block]="true">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>First</bit-label>
            <bit-hint>This is a hint for the first option</bit-hint>
          </bit-form-control>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Second</bit-label>
            <bit-hint>This is a hint for the second option</bit-hint>
          </bit-form-control>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Third</bit-label>
            <bit-hint>This is a hint for the third option</bit-hint>
          </bit-form-control>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const BlockHint: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio" [block]="true">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>First</bit-label>
            <bit-hint>This is a hint for the first option</bit-hint>
          </bit-form-control>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Second</bit-label>
            <bit-hint>This is a hint for the second option</bit-hint>
          </bit-form-control>

          <bit-form-control disableMargin>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Third</bit-label>
            <bit-hint>This is a hint for the third option</bit-hint>
          </bit-form-control>

          <bit-hint>This is a hint for the radio group</bit-hint>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const Required: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0, Validators.required),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>First</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Second</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Third</bit-label>
          </bit-form-control>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const Inactive: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group formControlName="radio">
          <bit-label>Group of radio buttons</bit-label>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="0" [disabled]="true" />
            <bit-label>First</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="1" [disabled]="true" />
            <bit-label>Second</bit-label>
          </bit-form-control>

          <bit-form-control [inline]="true" disableMargin>
            <input type="radio" bitRadio [value]="2" [disabled]="true" />
            <bit-label>Third</bit-label>
          </bit-form-control>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const FormControlCard: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group [block]="true" formControlName="radio">
          <bit-label>Select an option</bit-label>

          <bit-form-control-card>
            <input type="radio" bitRadio [value]="0" />
            <bit-label>Option A</bit-label>
          </bit-form-control-card>
          <bit-form-control-card>
            <input type="radio" bitRadio [value]="1" />
            <bit-label>Option B</bit-label>
          </bit-form-control-card>
          <bit-form-control-card>
            <input type="radio" bitRadio [value]="2" />
            <bit-label>Option C</bit-label>
          </bit-form-control-card>

          <bit-hint>Choose one of the options above.</bit-hint>
        </bit-form-control-group>
      </form>
    `,
  }),
};

export const InactiveFormControlCard: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-group [block]="true" formControlName="radio">
          <bit-label>Select an option</bit-label>

          <bit-form-control-card>
            <input type="radio" bitRadio [value]="0" [disabled]="true" />
            <bit-label>Option A</bit-label>
          </bit-form-control-card>
          <bit-form-control-card>
            <input type="radio" bitRadio [value]="1" [disabled]="true" />
            <bit-label>Option B</bit-label>
          </bit-form-control-card>
          <bit-form-control-card>
            <input type="radio" bitRadio [value]="2" [disabled]="true" />
            <bit-label>Option C</bit-label>
          </bit-form-control-card>

          <bit-hint>Choose one of the options above.</bit-hint>
        </bit-form-control-group>
      </form>
    `,
  }),
};
