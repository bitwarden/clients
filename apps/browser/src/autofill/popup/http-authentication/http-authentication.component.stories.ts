import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { findByRole, userEvent } from "storybook/test";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { DialogModule, I18nMockService, ToastService } from "@bitwarden/components";
import { enabledFlags } from "@bitwarden/storybook";
import { PasswordRepromptService } from "@bitwarden/vault";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";
import { FillCipherPolicy } from "../../services/abstractions/fill-cipher-policy";

import { HttpAuthenticationComponent } from "./http-authentication.component";

const requestOrigin = "https://intranet.example.com";

const createLogin = (
  id: string,
  name: string,
  username: string,
  reprompt: CipherRepromptType = CipherRepromptType.None,
) => {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  cipher.type = CipherType.Login;
  cipher.reprompt = reprompt;
  cipher.login = new LoginView();
  cipher.login.username = username;
  return cipher;
};

const logins = [
  createLogin("login-1", "Intranet", "jane.doe@example.com"),
  createLogin("login-2", "Intranet (admin)", "admin@example.com"),
  createLogin(
    "login-3",
    "Intranet (reprompt)",
    "john.doe@example.com",
    CipherRepromptType.Password,
  ),
];

const routes: Routes = [{ path: "http-authentication", component: HttpAuthenticationComponent }];

/** Opens the popout's route with the query parameters the background sends. */
const atPopoutUrl =
  (cipherIds: string[]): Decorator =>
  (storyFn, context) => {
    const query = new URLSearchParams({
      sessionId: "story-session",
      requestOrigin,
      cipherIds: cipherIds.join(","),
    });
    window.location.hash = `/http-authentication?${query.toString()}`;
    return storyFn(context);
  };

export default {
  title: "Browser/Autofill/HTTP Authentication Popout",
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  component: HttpAuthenticationComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        provideNoopAnimations(),
        provideRouter(routes, withHashLocation()),
        importProvidersFrom(DialogModule),
        PasswordRepromptService,
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              appLogoLabel: "Bitwarden logo",
              back: "Back",
              loading: "Loading",
              close: "Close",
              fillLoginPopUpPromptsLogInTo: (origin) => `Log in to ${origin}`,
              fillLoginPopUpPromptsChooseLogin: (origin) => `Choose a login for ${origin}`,
              fillLoginPopUpPromptsUseBrowserInstead: "Use browser instead",
              passwordConfirmation: "Master password confirmation",
              passwordConfirmationDesc:
                "This action is protected. To continue, please re-enter your master password to verify your identity.",
              masterPass: "Master password",
              required: "required",
              toggleVisibility: "Toggle visibility",
              ok: "Ok",
              cancel: "Cancel",
            }),
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-id" }) },
        },
        {
          provide: FillCipherPolicy,
          useValue: {
            ciphersForIds: async (_userId: string, cipherIds: string[]) =>
              logins.filter((login) => cipherIds.includes(login.id)),
          },
        },
        {
          provide: UserVerificationService,
          useValue: { hasMasterPassword: async () => true },
        },
        {
          provide: MasterPasswordUnlockService,
          useValue: { proofOfDecryption: async () => true },
        },
        { provide: PlatformUtilsService, useValue: {} },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.example.com" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(false) } },
        { provide: LogService, useValue: { error: () => {}, warning: () => {} } },
        { provide: PopupRouterCacheService, useValue: { back: () => {} } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
} as Meta<HttpAuthenticationComponent>;

type Story = StoryObj<HttpAuthenticationComponent>;

/** One matching login with the setting on. */
export const OneLogin: Story = {
  decorators: [atPopoutUrl(["login-1"])],
};

/** Several matching logins with the setting on, in the order the background offered them. */
export const SeveralLogins: Story = {
  decorators: [atPopoutUrl(["login-1", "login-2", "login-3"])],
};

/** Choosing a login with master password re-prompt on asks for the master password first. */
export const MasterPasswordStep: Story = {
  decorators: [atPopoutUrl(["login-1", "login-3"])],
  play: async ({ canvasElement }) => {
    const repromptLogin = await findByRole(canvasElement, "button", {
      name: /Intranet \(reprompt\)/,
    });
    await userEvent.click(repromptLogin);
  },
};
