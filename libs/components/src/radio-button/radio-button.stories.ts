import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { RadioButtonModule } from "./radio-button.module";
import { RadioGroupComponent } from "./radio-group.component";

export default {
  title: "Component Library/Form/Radio Button",
  component: RadioGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, ReactiveFormsModule, RadioButtonModule],
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
} as Meta<RadioGroupComponent>;

type Story = StoryObj<RadioGroupComponent>;

export const Inline: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-radio-group formControlName="radio" aria-label="Example radio group">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button id="radio-first" [value]="0">
            <bit-label>First</bit-label>
          </bit-radio-button>

          <bit-radio-button id="radio-second" [value]="1">
            <bit-label>Second</bit-label>
          </bit-radio-button>

          <bit-radio-button id="radio-third" [value]="2">
            <bit-label>Third</bit-label>
          </bit-radio-button>
        </bit-radio-group>
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
        <bit-radio-group formControlName="radio" aria-label="Example radio group">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button id="radio-first" [value]="0">
            <bit-label>First</bit-label>
          </bit-radio-button>

          <bit-radio-button id="radio-second" [value]="1">
            <bit-label>Second</bit-label>
          </bit-radio-button>

          <bit-radio-button id="radio-third" [value]="2">
            <bit-label>Third</bit-label>
          </bit-radio-button>

          <bit-hint>This is a hint for the radio group</bit-hint>
        </bit-radio-group>
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
        <bit-radio-group formControlName="radio" aria-label="Example radio group" [block]="true">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button id="radio-first" [value]="0">
            <bit-label>First</bit-label>
            <bit-hint>This is a hint for the first option</bit-hint>
          </bit-radio-button>

          <bit-radio-button id="radio-second" [value]="1">
            <bit-label>Second</bit-label>
            <bit-hint>This is a hint for the second option</bit-hint>
          </bit-radio-button>

          <bit-radio-button id="radio-third" [value]="2">
            <bit-label>Third</bit-label>
            <bit-hint>This is a hint for the third option</bit-hint>
          </bit-radio-button>
        </bit-radio-group>
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
        <bit-radio-group formControlName="radio" aria-label="Example radio group" [block]="true">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button id="radio-first" [value]="0">
            <bit-label>First</bit-label>
            <bit-hint>This is a hint for the first option</bit-hint>
          </bit-radio-button>

          <bit-radio-button id="radio-second" [value]="1">
            <bit-label>Second</bit-label>
            <bit-hint>This is a hint for the second option</bit-hint>
          </bit-radio-button>

          <bit-radio-button id="radio-third" [value]="2">
            <bit-label>Third</bit-label>
            <bit-hint>This is a hint for the third option</bit-hint>
          </bit-radio-button>

          <bit-hint>This is a hint for the radio group</bit-hint>
        </bit-radio-group>
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
        <bit-radio-group formControlName="radio" aria-label="Example radio group">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button [value]="0">
            <bit-label>First</bit-label>
          </bit-radio-button>

          <bit-radio-button [value]="1">
            <bit-label>Second</bit-label>
          </bit-radio-button>

          <bit-radio-button [value]="2">
            <bit-label>Third</bit-label>
          </bit-radio-button>
        </bit-radio-group>
      </form>
    `,
  }),
};

export const Disabled: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        radio: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-radio-group formControlName="radio" aria-label="Example radio group">
          <bit-label>Group of radio buttons</bit-label>

          <bit-radio-button [value]="0" [disabled]="true">
            <bit-label>First</bit-label>
          </bit-radio-button>

          <bit-radio-button [value]="1" [disabled]="true">
            <bit-label>Second</bit-label>
          </bit-radio-button>

          <bit-radio-button [value]="2" [disabled]="true">
            <bit-label>Third</bit-label>
          </bit-radio-button>
        </bit-radio-group>
      </form>
    `,
  }),
};
