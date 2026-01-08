import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AdditionalOptionsCardComponent } from "./additional-options-card.component";

export default {
  title: "Billing/Additional Options Card",
  component: AdditionalOptionsCardComponent,
  description:
    "Displays additional subscription management options with action buttons for downloading license and canceling subscription.",
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, CardComponent, TypographyModule, I18nPipe],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              const translations: Record<string, string> = {
                additionalOptions: "Additional options",
                additionalOptionsDesc:
                  "For additional help in managing your subscription, please contact Customer Support.",
                downloadLicense: "Download license",
                cancelSubscription: "Cancel subscription",
              };
              return translations[key] || key;
            },
          },
        },
      ],
    }),
  ],
} as Meta<AdditionalOptionsCardComponent>;

type Story = StoryObj<AdditionalOptionsCardComponent>;

export const Default: Story = {
  args: {},
};

export const ActionsDisabled: Story = {
  name: "Actions Disabled",
  args: {
    callsToActionDisabled: true,
  },
};
