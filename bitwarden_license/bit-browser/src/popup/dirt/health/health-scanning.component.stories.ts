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
              scanningYourVaultDescription:
                "Checking your passwords for exposure, weakness, and reuse. This may take a moment.",
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
    // The spinner and the body copy are theme-aware, so dark has to be
    // snapshotted explicitly or a dark-mode colour regression ships unseen.
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta<HealthScanningComponent>;

type Story = StoryObj<HealthScanningComponent>;

/** Shown while the vault-health scan is running. The component takes no inputs. */
export const Default: Story = {};
