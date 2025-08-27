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
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-35836&t=b5tDKylm5sWm2yKo-4",
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
  render: () => ({
    template: /* HTML */ `
      <bit-switch [disabled]="true">
        <bit-label>Example switch</bit-label>
        <bit-hint>This is a hint for the switch</bit-hint>
      </bit-switch>
    `,
  }),
};
