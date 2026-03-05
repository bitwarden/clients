import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { I18nMockService } from "@bitwarden/components";

import { PasswordCalloutComponent } from "./password-callout.component";

export default {
  title: "Auth/Password Callout",
  component: PasswordCalloutComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              masterPasswordPolicyInEffect:
                "One or more organization policies require your master password to meet the following requirements:",
              policyInEffectMinLength: "Minimum length of __$1__",
              policyInEffectMinComplexity: "Minimum complexity score of __$1__",
              policyInEffectUppercase: "Contain one or more uppercase characters",
              policyInEffectLowercase: "Contain one or more lowercase characters",
              policyInEffectNumbers: "Contain one or more numbers",
              policyInEffectSpecial:
                "Contain one or more of the following special characters $CHARS$",
              weak: "Weak",
              good: "Good",
              strong: "Strong",
            });
          },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PasswordCalloutComponent>;

export const Default: Story = {
  args: {
    policy: {
      minComplexity: 3,
      minLength: 10,
      requireUpper: true,
      requireLower: true,
      requireNumbers: true,
      requireSpecial: true,
    } as MasterPasswordPolicyOptions,
  },
};
