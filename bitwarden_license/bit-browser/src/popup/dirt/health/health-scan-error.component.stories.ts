import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { HealthScanErrorComponent } from "./health-scan-error.component";

export default {
  title: "Browser/DIRT/Health/Health Scan Failure",
  component: HealthScanErrorComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              healthScanFailed: "Something went wrong",
              healthScanFailedDescription:
                "Your vault scan didn't complete due to an unexpected error.",
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
    // The error visual and the body copy are theme-aware, so dark has to be
    // snapshotted explicitly or a dark-mode colour regression ships unseen.
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta<HealthScanErrorComponent>;

type Story = StoryObj<HealthScanErrorComponent>;

/** Shown when the vault-health scan does not complete. The component takes no inputs. */
export const Default: Story = {};
