import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormControlModule } from "../form-control";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SwitchComponent } from "./switch.component";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";

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
      description: "Model signal for disabled binding when used outside of a form",
    },
    selected: {
      control: "boolean",
      description: "Model signal for selected state binding when used outside of a form",
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/8UUiry70QWI1VjILxo75GS/Tailwind-Component-Library?m=auto&node-id=30341-13313&t=83S7fjfIUxQJsM2r-1",
    },
  },
} as Meta<SwitchComponent>;

type Story = StoryObj<SwitchComponent & { disabled?: boolean; selected?: boolean }>;

export const Default: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <bit-switch ${formatArgsForCodeSnippet<SwitchComponent>(args)}>
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
  args: {
    disabled: false,
    selected: true,
  },
};

export const WithLongLabel: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <bit-switch ${formatArgsForCodeSnippet<SwitchComponent>(args)}>
        <bit-label
          >This example switch has a super long label. This is not recommended. Switch labels should
          be clear and concise. They should tell the user what turning on the switch will
          do.</bit-label
        >
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
  args: {
    disabled: false,
    selected: true,
  },
};

export const WithForm: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(0),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-switch formControlName="switch" ${formatArgsForCodeSnippet<SwitchComponent>(args)}>
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
      <bit-switch
        disabledReasonText="Switch disabled because I am not allowed to change it"
        ${formatArgsForCodeSnippet<SwitchComponent>(args)}
      >
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
  args: {
    disabled: true,
    selected: true,
  },
};
