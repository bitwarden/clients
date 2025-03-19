// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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

import { InputPasswordComponent } from "./input-password.component";

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
              let score = 0;
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
    masterPasswordPolicyOptions: {
      minComplexity: 4,
      minLength: 14,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
    } as MasterPasswordPolicyOptions,
  },
} as Meta;

type Story = StoryObj<InputPasswordComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password></auth-input-password>
    `,
  }),
};

export const WithPolicy: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password [masterPasswordPolicyOptions]="masterPasswordPolicyOptions"></auth-input-password>
    `,
  }),
};

export const InlineButton: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-input-password [btnBlock]="false" [masterPasswordPolicyOptions]="masterPasswordPolicyOptions"></auth-input-password>
    `,
  }),
};
