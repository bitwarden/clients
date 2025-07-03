import { Component } from "@angular/core";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { FormFieldModule } from "../form-field";

import { AutofocusDirective } from "./autofocus.directive";

@Component({
  selector: "autofocus-example",
  imports: [FormFieldModule, AutofocusDirective],
  template: ` <bit-form-field>
    <bit-label>Email</bit-label>
    <input bitInput formControlName="email" appAutofocus />
  </bit-form-field>`,
})
class AutofocusExampleComponent {}

export default {
  title: "Component Library/Form/Autofocus Directive",
  component: AutofocusDirective,
  decorators: [
    moduleMetadata({
      imports: [AutofocusExampleComponent],
    }),
  ],
} as Meta;

type Story = StoryObj<AutofocusExampleComponent>;

export const AutofocusField: Story = {
  render: (args) => ({
    template: `<autofocus-example></autofocus-example>`,
  }),
};
