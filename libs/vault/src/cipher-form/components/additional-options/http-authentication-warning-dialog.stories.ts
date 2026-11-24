import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, I18nMockService } from "@bitwarden/components";

import { HTTPAuthenticationWarningDialogComponent } from "./http-authentication-warning-dialog.component";

export default {
  title: "Vault/Cipher Form/HTTP Authentication Warning Dialog",
  component: HTTPAuthenticationWarningDialogComponent,
  decorators: [
    applicationConfig({ providers: [provideNoopAnimations()] }),
    moduleMetadata({
      imports: [HTTPAuthenticationWarningDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: () => {} } },
        { provide: PlatformUtilsService, useValue: { launchUri: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              fillLoginPopUpPromptsTitle: "Filling pop-up prompts",
              fillLoginPopUpPromptsWarning:
                "When this setting is on, the browser may use your credentials again without prompting after the first fill.",
              learnMore: "Learn more",
              fillLoginPopUpPromptsHelpArticleSignpost:
                "Learn more about filling pop-up prompts (opens in a new tab)",
              turnOn: "Turn on",
              cancel: "Cancel",
            }),
        },
      ],
    }),
  ],
} as Meta<HTTPAuthenticationWarningDialogComponent>;

export const Default: StoryObj<HTTPAuthenticationWarningDialogComponent> = {};
