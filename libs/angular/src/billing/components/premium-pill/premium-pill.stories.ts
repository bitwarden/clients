import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { JslibModule } from "../../../jslib.module";

import { PremiumPillComponent } from "./premium-pill.component";

export default {
  title: "Billing/Premium Pill",
  component: PremiumPillComponent,
  parameters: {
    docs: {
      description: {
        component:
          "The passive Premium pill: a brand badge with the premium icon and label, shown next to a feature that requires premium.",
      },
    },
  },
  decorators: [
    moduleMetadata({
      imports: [JslibModule, PremiumPillComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ premium: "Premium" }),
        },
      ],
    }),
  ],
} as Meta<PremiumPillComponent>;

type Story = StoryObj<PremiumPillComponent>;

export const Default: Story = {};
