import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import {
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  TwoFactorMethod,
} from "../../importers/keeper/access";

import { KeeperInlineAuthUi, KeeperInlineScreen } from "./direct/keeper/keeper-inline-auth-ui";
import { ImportControlsKeeperLoginComponent } from "./import-controls-keeper-login.component";

const storyFor = (stage: KeeperInlineScreen): Story => ({ args: { stage } });

export default {
  title: "Tools/Import/Controls/Keeper login",
  component: ImportControlsKeeperLoginComponent,
  decorators: [
    moduleMetadata({
      providers: [
        // The card only registers how to answer and forwards Resend; nothing is running to talk to.
        {
          provide: KeeperInlineAuthUi,
          useValue: { registerAnswerer: (): void => undefined, resend: (): void => undefined },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              // Resolved by every field and the spinner/callout components themselves.
              required: "required",
              loading: "Loading",
              close: "Close",
              toggleVisibility: "Toggle visibility",
              inputRequired: "This field is required.",
              verificationCodeRequired: "Verification code is required.",
              keeperLoginCodeInvalid: "Enter a valid verification code.",
              keeperLoginPasswordRequired: "Password is required.",
              keeperLoginPasswordInvalid: "Enter a valid password.",
              importingYourAccount: "Importing your account...",
              keeperLoginApprovalMethod: "Device approval method",
              email: "Email",
              keeperPush: "Keeper Push",
              adminApproval: "Admin approval",
              twoFactorMethod: "Two-factor method",
              keeperDna: "Keeper DNA",
              verificationCode: "Verification code",
              resendCode: "Resend code",
              keeperPushSent: "Keeper Push sent",
              keeperLoginPushSentDesc: "Keeper Push notification sent to approved device.",
              adminApprovalRequested: "Admin approval requested",
              keeperLoginAdminRequestedDesc: "We’ve sent an admin approval request to your admin.",
              selectTwoFactorMethod: "Select two-factor method",
              authenticatorAppTotp: "Authenticator app (TOTP)",
              textMessageSms: "Text message (SMS)",
              duoSecurity: "Duo Security",
              rsaSecurId: "RSA SecurID",
              backupCodes: "Backup codes",
              securityKeyU2f: "Security key (U2F)",
              securityKeyWebAuthn: "Security key (WebAuthn)",
              unknownMethod: "Unknown method",
              mfaPushDesc: "Approve the request on your device, then select Continue.",
              duoVerification: "Duo verification",
              duoPush: "Duo Push",
              phoneCall: "Phone call",
              passcode: "Passcode",
              duoPushWaiting: "Waiting for you to approve the Duo request",
              keeperDnaVerification: "Keeper DNA verification",
              pushNotification: "Push notification",
              enterCodeManually: "Enter code manually",
              keeperLoginDnaSent: "Keeper DNA sent",
              keeperLoginDnaSentDesc: "Approve the Keeper DNA notification on your device.",
              ssoToken: "SSO token",
              ssoAuthRequired: "SSO authentication required",
              keeperSsoDesc:
                "Your Keeper account requires SSO authentication. Complete the sign-in in the browser window that was opened, then paste the token shown on the page.",
              masterPassword: "Master password",
            }),
        },
      ],
    }),
  ],
} as Meta<ImportControlsKeeperLoginComponent>;

type Story = StoryObj<ImportControlsKeeperLoginComponent>;

export const DeviceApprovalMethod: Story = storyFor({
  kind: "selectApproval",
  methods: [
    DeviceApprovalChannel.Email,
    DeviceApprovalChannel.KeeperPush,
    DeviceApprovalChannel.TwoFactor,
    DeviceApprovalChannel.KeeperDna,
  ],
});

/** The picker for the login state that offers Keeper Push and Admin approval only. */
export const DeviceApprovalMethodAdmin: Story = storyFor({
  kind: "selectApproval",
  methods: [DeviceApprovalChannel.KeeperPush, DeviceApprovalChannel.AdminApproval],
});

export const EmailVerification: Story = storyFor({
  kind: "approvalCode",
  method: DeviceApprovalChannel.Email,
  variant: "email",
  previousCodeRejected: false,
});

export const KeeperPushSent: Story = storyFor({
  kind: "approvalCode",
  method: DeviceApprovalChannel.KeeperPush,
  variant: "push",
  previousCodeRejected: false,
});

export const AdminApprovalRequested: Story = storyFor({
  kind: "approvalCode",
  method: DeviceApprovalChannel.AdminApproval,
  variant: "admin",
  previousCodeRejected: false,
});

export const MasterPassword: Story = storyFor({
  kind: "password",
  previousPasswordRejected: false,
});

/** Desktop and web: the user pastes the token. The extension shows `Loading` instead. */
export const SsoToken: Story = storyFor({ kind: "ssoToken" });

/** Not in Figma. Shown for accounts that need a second factor: the account's own Authenticator
 *  app, text message and Keeper DNA methods, built from the radio group. */
export const TwoFactorMethodPicker: Story = storyFor({
  kind: "selectTwoFactor",
  methods: [TwoFactorMethod.Totp, TwoFactorMethod.Sms, TwoFactorMethod.Backup],
});

/** Not in Figma: the Authenticator app and text message code screen (and the code screen behind
 *  "Two-factor method" at device approval), built from the verification code pattern. */
export const TwoFactorCode: Story = storyFor({
  kind: "twoFactorCode",
  method: TwoFactorMethod.Totp,
  needsInput: true,
  hidden: false,
  canResend: false,
  previousCodeRejected: false,
});

/** Not in Figma, and not reachable today: the client only offers Authenticator app, text message
 *  and Keeper DNA. A push-style second factor where Continue confirms the approval. */
export const TwoFactorPush: Story = storyFor({
  kind: "twoFactorCode",
  method: TwoFactorMethod.KeeperPush,
  needsInput: false,
  hidden: false,
  canResend: false,
  previousCodeRejected: false,
});

/** Not in Figma, and not reachable today: Duo is switched off in the client. */
export const DuoMethodPicker: Story = storyFor({
  kind: "selectDuo",
  methods: [DuoMethod.Push, DuoMethod.Sms, DuoMethod.Voice],
  phoneNumber: "+1 ••• ••• 1234",
});

/** Not in Figma, and not reachable today: Duo is switched off in the client. */
export const DuoPushWaiting: Story = storyFor({ kind: "duoPush", method: DuoMethod.Push });

/** Not in Figma, and not reachable today: the client never asks for a DNA method. Keeper DNA goes
 *  straight to the push wait below. */
export const KeeperDnaMethodPicker: Story = storyFor({
  kind: "selectDna",
  methods: [DnaMethod.Push, DnaMethod.Code],
});

/** Keeper DNA approval. There is no code entry; the user approves on the device. */
export const KeeperDnaPushWaiting: Story = storyFor({ kind: "dnaPush" });
