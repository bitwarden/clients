import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj, componentWrapperDecorator } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { FormControlModule } from "../form-control";
import { FormControlCardComponent } from "../form-control/form-control-card.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SwitchComponent } from "./switch.component";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";

export default {
  title: "Component Library/Form/Switch",
  component: SwitchComponent,
  decorators: [
    componentWrapperDecorator((story) => {
      return /* HTML */ `<div class="tw-max-w-[600px] ">${story}</div>`;
    }),
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        SwitchComponent,
        FormControlModule,
        FormControlCardComponent,
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
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Model signal for disabled binding when used outside of a form",
    },
    selected: {
      control: "boolean",
      description: "Model signal for selected state binding when used outside of a form",
    },
    size: {
      options: ["base", "large"],
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/branch/8UUiry70QWI1VjILxo75GS/Tailwind-Component-Library?m=auto&node-id=30341-13313&t=83S7fjfIUxQJsM2r-1",
    },
    controls: {
      // exclude ControlAccessorValue methods
      exclude: ["registerOnChange", "registerOnTouched", "setDisabledState", "writeValue"],
    },
  },
} as Meta<SwitchComponent>;

type Story = StoryObj<
  SwitchComponent & { disabled?: boolean; selected?: boolean; size: "base" | "large" }
>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-form-control>
        <bit-switch ${formatArgsForCodeSnippet<SwitchComponent>(args)}></bit-switch>
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-form-control>
    `,
  }),
  args: {
    disabled: false,
    selected: true,
  },
};

export const WithLongLabel: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-form-control>
        <bit-switch ${formatArgsForCodeSnippet<SwitchComponent>(args)}></bit-switch>
        <bit-label>
          This example switch has a super long label. This is not recommended. Switch labels should
          be clear and concise. They should tell the user what turning on the switch will do.
        </bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-form-control>
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
        switch: new FormControl(false),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control>
          <bit-switch
            formControlName="switch"
            ${formatArgsForCodeSnippet<SwitchComponent>(args)}
          ></bit-switch>
          <bit-label>Example switch</bit-label>
          <bit-hint>This is a hint for the switch</bit-hint>
        </bit-form-control>
      </form>
    `,
  }),
};

export const Inactive: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <bit-form-control>
        <bit-switch ${formatArgsForCodeSnippet<SwitchComponent>(args)}></bit-switch>
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-form-control>
    `,
  }),
  args: {
    disabled: true,
    selected: false,
  },
};

export const FormControlCard: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        switch: new FormControl(false),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-card icon="bwi-clock">
          <bit-switch formControlName="switch"></bit-switch>
          <bit-label>Enable feature</bit-label>
          <bit-hint>This feature does some pretty cool stuff</bit-hint>
        </bit-form-control-card>
      </form>
    `,
  }),
};

export const FormControlCardGroup: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        notifications: new FormControl(false),
        autoLock: new FormControl(true),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-card-group>
          <bit-label>Switch group</bit-label>

          <bit-form-control-card icon="bwi-envelope">
            <bit-switch formControlName="notifications"></bit-switch>
            <bit-label>Notifications</bit-label>
            <bit-hint>Enable email notifications</bit-hint>
          </bit-form-control-card>

          <bit-form-control-card icon="bwi-lock">
            <bit-switch formControlName="autoLock"></bit-switch>
            <bit-label>Auto-lock</bit-label>
            <bit-hint>Automatically lock after inactivity</bit-hint>
          </bit-form-control-card>
        </bit-form-control-card-group>
      </form>
    `,
  }),
};
