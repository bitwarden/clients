import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormControlModule } from "../form-control";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SwitchComponent } from "./switch.component";

export default {
  title: "Component Library/Form/Switch",
  component: SwitchComponent,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, ReactiveFormsModule, SwitchComponent, FormControlModule],
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
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Model signal manual disabled binding when used outside of a form",
    },
  },
  args: {
    disabled: false, // Initial value for the control
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/8UUiry70QWI1VjILxo75GS/Tailwind-Component-Library?m=auto&node-id=30341-13313&t=83S7fjfIUxQJsM2r-1",
    },
  },
} as Meta<SwitchComponent>;

type Story = StoryObj<SwitchComponent>;

export const Default: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <bit-switch>
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
};

export const WithForm: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-switch formControlName="switch">
          <bit-label>Example switch</bit-label>
          <bit-hint>This is a hint for the switch</bit-hint>
        </bit-switch>
      </form>
    `,
  }),
};

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-switch [disabled]="true">
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
};
