import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { FormFieldModule } from "../form-field";

import { AutofocusDirective } from "./autofocus.directive";

export default {
  title: "Component Library/Form/Autofocus Directive",
  component: AutofocusDirective,
  decorators: [
    moduleMetadata({
      imports: [AutofocusDirective, FormFieldModule],
    }),
  ],
} as Meta;

export const AutofocusField: StoryObj = {
  render: (args) => ({
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Email</bit-label>
        <input bitInput formControlName="email" appAutofocus />
      </bit-form-field>
    `,
  }),
};
