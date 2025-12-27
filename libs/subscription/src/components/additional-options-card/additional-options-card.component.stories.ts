import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { AdditionalOptionsCardComponent } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

export default {
  title: "Billing/Additional Options Card",
  component: AdditionalOptionsCardComponent,
  description:
    "A reusable UI-only component that displays additional subscription options with action buttons.",
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
                additionalOptionsDescription:
                  "For additional help managing your subscription, please contact Customer Support",
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

export const Default: Story = {};
