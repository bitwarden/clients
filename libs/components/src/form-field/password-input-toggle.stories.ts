import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
      imports: [FormsModule, ReactiveFormsModule, FormFieldModule, InputModule, IconButtonModule],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ toggleVisibility: "Toggle visibility" }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
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
    template: /*html*/ `
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
    template: /*html*/ `
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
