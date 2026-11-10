import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import {
  LastPassInlineAuthUi,
  LastPassInlineScreen,
} from "./direct/lastpass/lastpass-inline-auth-ui";
import { ImportControlsLastPassLoginComponent } from "./import-controls-lastpass-login.component";

const storyFor = (stage: LastPassInlineScreen): Story => ({ args: { stage } });

export default {
  title: "Tools/Import/Controls/LastPass login",
  component: ImportControlsLastPassLoginComponent,
  decorators: [
    moduleMetadata({
      providers: [
        // The card only registers how to answer; nothing is running to talk to.
        {
          provide: LastPassInlineAuthUi,
          useValue: { registerAnswerer: (): void => undefined, busy: signal(false) },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              // Resolved by every field and the spinner components themselves.
              required: "required",
              loading: "Loading",
              toggleVisibility: "Toggle visibility",
              inputRequired: "This field is required.",
              masterPassword: "Master password",
              verificationCode: "Verification code",
              verificationCodeRequired: "Verification code is required.",
              lastPassLoginPasswordRequired: "Password is required.",
              lastPassLoginPasswordInvalid: "Enter a valid password",
              lastPassLoginCodeInvalid: "Enter a valid verification code.",
              lastPassLoginWaitingForSso: "Waiting for SSO authentication",
              lastPassLoginWaitingForSsoDesc:
                "Once signed in, we’ll continue your import automatically.",
            }),
        },
      ],
    }),
  ],
} as Meta<ImportControlsLastPassLoginComponent>;

type Story = StoryObj<ImportControlsLastPassLoginComponent>;

export const MasterPassword: Story = storyFor({
  kind: "password",
  previousPasswordRejected: false,
});

/** LastPass rejected the password: the field shows "Enter a valid password". */
export const MasterPasswordRejected: Story = storyFor({
  kind: "password",
  previousPasswordRejected: true,
});

/** One field for authenticator, YubiKey and out-of-band passcodes. */
export const VerificationCode: Story = storyFor({ kind: "code", previousCodeRejected: false });

/** LastPass rejected the code: the field shows "Enter a valid verification code." */
export const VerificationCodeRejected: Story = storyFor({
  kind: "code",
  previousCodeRejected: true,
});

/** The identity provider's sign-in is open in another tab. Continue is disabled. */
export const SsoWaiting: Story = storyFor({ kind: "sso" });
