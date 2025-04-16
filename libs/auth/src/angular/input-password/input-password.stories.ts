import { importProvidersFrom } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { action } from "@storybook/addon-actions";
import { Meta, StoryObj, applicationConfig } from "@storybook/angular";
import { ZXCVBNResult } from "zxcvbn";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

// FIXME: remove `/apps` import from `/libs`
// FIXME: remove `src` and fix import
// eslint-disable-next-line import/no-restricted-paths, no-restricted-imports
import { PreloadedEnglishI18nModule } from "../../../../../apps/web/src/app/core/tests";

import { InputPasswordComponent, InputPasswordFlow } from "./input-password.component";

export default {
  title: "Auth/Input Password",
  component: InputPasswordComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(BrowserAnimationsModule),
        {
          provide: AuditService,
          useValue: {
            passwordLeaked: () => Promise.resolve(1),
          } as Partial<AuditService>,
        },
        {
          provide: KeyService,
          useValue: {
            makeMasterKey: () => Promise.resolve("example-master-key"),
            hashMasterKey: () => Promise.resolve("example-master-key-hash"),
          },
        },
        {
          provide: DialogService,
          useValue: {
            openSimpleDialog: () => Promise.resolve(true),
          } as Partial<DialogService>,
        },
        {
          provide: PolicyService,
          useValue: {
            evaluateMasterPassword: (score) => {
              if (score < 4) {
                return false;
              }
              return true;
            },
          } as Partial<PolicyService>,
        },
        {
          provide: PasswordStrengthServiceAbstraction,
          useValue: {
            getPasswordStrength: (password) => {
              let score: number | null = null;
              if (password.length === 0) {
                score = null;
              } else if (password.length <= 4) {
                score = 1;
              } else if (password.length <= 8) {
                score = 2;
              } else if (password.length <= 12) {
                score = 3;
              } else {
                score = 4;
              }
              return { score } as ZXCVBNResult;
            },
          } as Partial<PasswordStrengthServiceAbstraction>,
        },
        {
          provide: ToastService,
          useValue: {
            showToast: action("ToastService.showToast"),
          } as Partial<ToastService>,
        },
      ],
    }),
  ],
  args: {
    InputPasswordFlow: {
      SetInitialPassword: InputPasswordFlow.SetInitialPassword,
      ChangePassword: InputPasswordFlow.ChangePassword,
      ChangePasswordWithOptionalUserKeyRotation:
        InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation,
    },
    masterPasswordPolicyOptions: {
      minComplexity: 4,
      minLength: 14,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
    } as MasterPasswordPolicyOptions,
    argTypes: {
      onSecondaryButtonClick: { action: "onSecondaryButtonClick" },
    },
  },
} as Meta;

type Story = StoryObj<InputPasswordComponent>;

export const SetInitialPassword: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"></auth-input-password>
    `,
  }),
};

export const ChangePassword: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password [inputPasswordFlow]="InputPasswordFlow.ChangePassword"></auth-input-password>
    `,
  }),
};

export const ChangePasswordWithOptionalUserKeyRotation: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation"
      ></auth-input-password>
    `,
  }),
};

export const WithPolicies: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"
        [masterPasswordPolicyOptions]="masterPasswordPolicyOptions"
      ></auth-input-password>
    `,
  }),
};

export const SecondaryButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"
        [secondaryButtonText]="{ key: 'cancel' }"
        (onSecondaryButtonClick)="onSecondaryButtonClick()"
      ></auth-input-password>
    `,
  }),
};

export const SecondaryButtonWithPlaceHolderText: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"
        [secondaryButtonText]="{ key: 'backTo', placeholders: ['homepage'] }"
        (onSecondaryButtonClick)="onSecondaryButtonClick()"
      ></auth-input-password>
    `,
  }),
};

export const InlineButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"
        [inlineButtons]="true"
      ></auth-input-password>
    `,
  }),
};

export const InlineButtons: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password
        [inputPasswordFlow]="InputPasswordFlow.SetInitialPassword"
        [secondaryButtonText]="{ key: 'cancel' }"
        [inlineButtons]="true"
        (onSecondaryButtonClick)="onSecondaryButtonClick()"
      ></auth-input-password>
    `,
  }),
};
