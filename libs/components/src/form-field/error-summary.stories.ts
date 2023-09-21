import { UntypedFormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BitFormFieldComponent } from "./form-field.component";
import { FormFieldModule } from "./form-field.module";

export default {
  title: "Component Library/Form/Error Summary",
  component: BitFormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, ReactiveFormsModule, FormFieldModule, InputModule, ButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              required: "required",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
              fieldsNeedAttention: "__$1__ field(s) above need your attention.",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A17689",
    },
  },
} as Meta;

const fb = new UntypedFormBuilder();

const formObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email]],
});

function submit() {
  formObj.markAllAsTouched();
}

export const Default: StoryObj<BitFormFieldComponent> = {
  render: (args) => ({
    props: {
      formObj: formObj,
      submit: submit,
      ...args,
    },
    template: `
      <form [formGroup]="formObj" (ngSubmit)="submit()">
        <bit-form-field>
          <bit-label>Name</bit-label>
          <input bitInput formControlName="name" />
        </bit-form-field>

        <bit-form-field>
          <bit-label>Email</bit-label>
          <input bitInput formControlName="email" />
        </bit-form-field>

        <button type="submit" bitButton buttonType="primary">Submit</button>
        <bit-error-summary [formGroup]="formObj"></bit-error-summary>
      </form>
    `,
  }),
};
