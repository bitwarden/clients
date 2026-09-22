import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, I18nMockService } from "@bitwarden/components";

import { ExtendLeaseDialogComponent } from "./extend-lease-dialog.component";

export default {
  title: "Browser/PAM/Extend Lease Dialog",
  component: ExtendLeaseDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ExtendLeaseDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              cancel: "Cancel",
              pamAccessRuleDuration1h: "1 hour",
              pamAccessRuleDuration2h: "2 hours",
              pamAccessRuleDuration30m: "30 minutes",
              pamAccessRuleDuration4h: "4 hours",
              pamAccessRuleDuration8h: "8 hours",
              pamExtendLeaseButton: "Extend",
              pamExtendLeaseDialogTitle: "Extend access",
              pamExtendLeaseDurationLabel: "Extension length",
              pamExtendLeaseReasonLabel: "Reason",
              required: "required",
            }),
        },
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta<ExtendLeaseDialogComponent>;

type Story = StoryObj<ExtendLeaseDialogComponent>;

/**
 * Opened from the active-lease card. Extend stays disabled until a reason is given, since the server
 * rejects an extension request with an empty one.
 */
export const Default: Story = {};
