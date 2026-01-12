import { CommonModule } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CardComponent,
  ProgressModule,
  TypographyModule,
} from "@bitwarden/components";
import { Storage, StorageCardComponent } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

export default {
  title: "Billing/Storage Card",
  component: StorageCardComponent,
  description:
    "Displays storage usage with a visual progress bar and action buttons for adding or removing storage.",
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        ButtonModule,
        CardComponent,
        ProgressModule,
        TypographyModule,
        I18nPipe,
      ],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                storage: "Storage",
                storageFull: "Storage full",
                storageUsedDescription: `You have used ${args[0]} out of ${args[1]} GB of your encrypted file storage.`,
                storageFullDescription: `You have used all ${args[0]} GB of your encrypted storage. To continue storing files, add more storage.`,
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

export const Empty: Story = {
  args: {
    storage: {
      available: 5,
      used: 0,
      readableUsed: "0 GB",
    } satisfies Storage,
  },
};

export const Used: Story = {
  args: {
    storage: {
      available: 5,
      used: 2.5,
      readableUsed: "2.5 GB",
    } satisfies Storage,
  },
};

export const Full: Story = {
  args: {
    storage: {
      available: 5,
      used: 5,
      readableUsed: "5 GB",
    } satisfies Storage,
  },
};

export const LowUsage: Story = {
  name: "Low Usage (10%)",
  args: {
    storage: {
      available: 5,
      used: 0.5,
      readableUsed: "500 MB",
    } satisfies Storage,
  },
};

export const MediumUsage: Story = {
  name: "Medium Usage (75%)",
  args: {
    storage: {
      available: 5,
      used: 3.75,
      readableUsed: "3.75 GB",
    } satisfies Storage,
  },
};

export const NearlyFull: Story = {
  name: "Nearly Full (95%)",
  args: {
    storage: {
      available: 5,
      used: 4.75,
      readableUsed: "4.75 GB",
    } satisfies Storage,
  },
};

export const LargeStorage: Story = {
  name: "Large Storage Pool (1TB)",
  args: {
    storage: {
      available: 1000,
      used: 734,
      readableUsed: "734 GB",
    } satisfies Storage,
  },
};

export const SmallStorage: Story = {
  name: "Small Storage Pool (1GB)",
  args: {
    storage: {
      available: 1,
      used: 0.8,
      readableUsed: "800 MB",
    } satisfies Storage,
  },
};

export const ActionsDisabled: Story = {
  name: "Actions Disabled",
  args: {
    storage: {
      available: 5,
      used: 2.5,
      readableUsed: "2.5 GB",
    } satisfies Storage,
    addStorageDisabled: true,
    removeStorageDisabled: true,
  },
};

export const AddStorageDisabled: Story = {
  name: "Add Storage Disabled",
  args: {
    storage: {
      available: 5,
      used: 2.5,
      readableUsed: "2.5 GB",
    } satisfies Storage,
    addStorageDisabled: true,
    removeStorageDisabled: false,
  },
};

export const RemoveStorageDisabled: Story = {
  name: "Remove Storage Disabled",
  args: {
    storage: {
      available: 5,
      used: 2.5,
      readableUsed: "2.5 GB",
    } satisfies Storage,
    addStorageDisabled: false,
    removeStorageDisabled: true,
  },
};
