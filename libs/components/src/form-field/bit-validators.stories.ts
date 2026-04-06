import { FormsModule, ReactiveFormsModule, FormBuilder } from "@angular/forms";
import { StoryObj, Meta, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { forbiddenCharacters } from "./bit-validators/forbidden-characters.validator";
import { trimValidator } from "./bit-validators/trim.validator";
import { BitFormFieldComponent } from "./form-field.component";
import { FormFieldModule } from "./form-field.module";

export default {
  title: "Component Library/Form/Custom Validators",
  component: BitFormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [FormsModule, ReactiveFormsModule, FormFieldModule, InputModule, ButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              inputForbiddenCharacters: (chars) =>
                `The following characters are not allowed: ${chars}`,
              inputTrimValidator: "Input must not contain only whitespace.",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

const template = `
  <form [formGroup]="formObj">
    <bit-form-field>
      <bit-label>Name</bit-label>
      <input bitInput formControlName="name" />
    </bit-form-field>
  </form>`;

export const ForbiddenCharacters: StoryObj<BitFormFieldComponent> = {
  render: (args) => ({
    props: {
      formObj: new FormBuilder().group({
        name: ["", forbiddenCharacters(["\\", "/", "@", "#", "$", "%", "^", "&", "*", "(", ")"])],
      }),
    },
    template,
  }),
};

export const TrimValidator: StoryObj<BitFormFieldComponent> = {
  render: (args) => ({
    props: {
      formObj: new FormBuilder().group({
        name: [
          "",
          {
            updateOn: "submit",
            validators: [trimValidator],
          },
        ],
      }),
    },
    template,
  }),
};
