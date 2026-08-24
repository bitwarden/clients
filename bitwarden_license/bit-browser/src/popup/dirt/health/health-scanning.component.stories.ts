import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { HealthScanningComponent } from "./health-scanning.component";

export default {
  title: "Browser/DIRT/Health Scan Progress",
  component: HealthScanningComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              scanningYourVault: "Scanning your vault",
              scanningYourVaultDescription: "Checking for exposed, weak, and reused passwords.",
              scanInProgress: "In progress",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/JZf3F2PRqB7HhflAybw2Xe/Premium-end-user-health?node-id=730-4635",
    },
    // The bar is advanced by a setInterval that Chromatic does not pause, so its
    // width at capture time is arbitrary and every snapshot reads as a visual
    // change needing manual approval. The story is still useful in Storybook.
    chromatic: { disableSnapshot: true },
  },
} as Meta<HealthScanningComponent>;

type Story = StoryObj<HealthScanningComponent>;

/** Shown while the vault-health scan is running. The bar animates; it takes no inputs. */
export const Default: Story = {};
