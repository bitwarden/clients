import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogModule } from "../dialog";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormFieldModule } from "./form-field.module";
import { BitPasswordInputToggleDirective } from "./password-input-toggle.directive";

export default {
  title: "Component Library/Form/Password Toggle",
  component: BitPasswordInputToggleDirective,
  decorators: [
    moduleMetadata({
      imports: [
        DialogModule,
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        IconButtonModule,
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            toggleVisibility: "Toggle visibility",
            close: "Close",
          }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/f32LSg3jaegICkMu7rPARm/Tailwind-Component-Library-Update?node-id=1881%3A17689",
    },
    docs: {
      description: {
        component:
          "Directive for toggling the visibility of a password input. Works by either having living inside a `bit-form-field` or by using the `toggled` two-way binding.",
      },
    },
  },
} as Meta;

type Story = StoryObj<BitPasswordInputToggleDirective>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <form>
        <bit-form-field>
          <bit-label>Password</bit-label>
          <input bitInput type="password" />
          <button type="button" bitIconButton bitSuffix bitPasswordInputToggle></button>
        </bit-form-field>
      </form>
    `,
  }),
};

export const Binding: Story = {
  render: (args) => ({
    props: args,
    template: `
      <form>
        <bit-form-field>
          <bit-label>Password</bit-label>
          <input bitInput type="password" />
          <button type="button" bitIconButton bitSuffix bitPasswordInputToggle [(toggled)]="toggled"></button>
        </bit-form-field>
  
        <label class="tw-text-main">
          Checked:
          <input type="checkbox" [(ngModel)]="toggled" [ngModelOptions]="{standalone: true}" />
        </label>
      </form>
    `,
  }),
  args: {
    toggled: false,
  },
};
