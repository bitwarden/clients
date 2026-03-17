import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CheckboxModule } from "../checkbox/checkbox.module";
import { SwitchComponent } from "../switch/switch.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormControlCardGroupComponent } from "./form-control-card-group.component";
import { FormControlCardComponent } from "./form-control-card.component";

export default {
  title: "Component Library/Form/Form Control Card",
  component: FormControlCardGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [
        FormsModule,
        ReactiveFormsModule,
        FormControlCardComponent,
        FormControlCardGroupComponent,
        CheckboxModule,
        SwitchComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              required: "required",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
            }),
        },
      ],
    }),
  ],
} as Meta<FormControlCardGroupComponent>;

type Story = StoryObj<FormControlCardGroupComponent>;

export const CheckboxCardGroup: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        featureA: new FormControl(false),
        featureB: new FormControl(true),
        featureC: new FormControl(false),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-card-group>
          <bit-label>Checkbox group</bit-label>

          <bit-form-control-card>
            <input type="checkbox" bitCheckbox formControlName="featureA" />
            <bit-label>Feature A</bit-label>
            <bit-hint>Enables Feature A for your account</bit-hint>
          </bit-form-control-card>

          <bit-form-control-card>
            <input type="checkbox" bitCheckbox formControlName="featureB" />
            <bit-label>Feature B</bit-label>
            <bit-hint>Enables Feature B for your account</bit-hint>
          </bit-form-control-card>

          <bit-form-control-card>
            <input type="checkbox" bitCheckbox formControlName="featureC" />
            <bit-label>Feature C</bit-label>
          </bit-form-control-card>

          <bit-hint>Choose which features to enable.</bit-hint>
        </bit-form-control-card-group>
      </form>
    `,
  }),
};

export const SwitchCardGroup: Story = {
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
            <bit-switch size="large" formControlName="notifications"></bit-switch>
            <bit-label>Notifications</bit-label>
            <bit-hint>Enable email notifications</bit-hint>
          </bit-form-control-card>

          <bit-form-control-card icon="bwi-lock">
            <bit-switch size="large" formControlName="autoLock"></bit-switch>
            <bit-label>Auto-lock</bit-label>
            <bit-hint>Automatically lock after inactivity</bit-hint>
          </bit-form-control-card>
        </bit-form-control-card-group>
      </form>
    `,
  }),
};

export const NoGroupLabel: Story = {
  render: () => ({
    props: {
      formObj: new FormGroup({
        featureA: new FormControl(false),
        featureB: new FormControl(false),
      }),
    },
    template: /* HTML */ `
      <form [formGroup]="formObj">
        <bit-form-control-card-group>
          <bit-form-control-card>
            <input type="checkbox" bitCheckbox formControlName="featureA" />
            <bit-label>Feature A</bit-label>
          </bit-form-control-card>

          <bit-form-control-card>
            <input type="checkbox" bitCheckbox formControlName="featureB" />
            <bit-label>Feature B</bit-label>
          </bit-form-control-card>
        </bit-form-control-card-group>
      </form>
    `,
  }),
};
