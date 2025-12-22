import { CommonModule } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { StorageCardComponent } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

export default {
  title: "Billing/Storage Card",
  component: StorageCardComponent,
  description:
    "A reusable UI-only component that displays a storage usage card with a progress bar and action buttons.",
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ButtonModule, CardComponent, TypographyModule, I18nPipe],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                storage: "Storage",
                youHaveUsedStorage: `You have used ${args[0]} out of ${args[1]} GB of your encrypted file storage.`,
                addStorage: "Add storage",
                removeStorage: "Remove storage",
              };

              return translations[key] || key;
            },
          },
        },
      ],
    }),
  ],
} as Meta<StorageCardComponent>;

type Story = StoryObj<StorageCardComponent>;

export const LowUsage: Story = {
  name: "Low Usage (20%)",
  args: {
    total: 5,
    used: 1,
  },
};

export const MediumUsage: Story = {
  name: "Medium Usage (50%)",
  args: {
    total: 10,
    used: 5,
  },
};

export const HighUsage: Story = {
  name: "High Usage (80%)",
  args: {
    total: 5,
    used: 4,
  },
};

export const NearlyFull: Story = {
  name: "Nearly Full (95%)",
  args: {
    total: 20,
    used: 19,
  },
};

export const AtCapacity: Story = {
  name: "At Capacity (100%)",
  args: {
    total: 5,
    used: 5,
  },
};

export const OverCapacity: Story = {
  name: "Over Capacity (110%)",
  args: {
    total: 5,
    used: 5.5,
  },
};

export const NoStorage: Story = {
  name: "No Storage Used",
  args: {
    total: 10,
    used: 0,
  },
};

export const LargeStorage: Story = {
  name: "Large Storage (100 GB)",
  args: {
    total: 100,
    used: 45,
  },
};
