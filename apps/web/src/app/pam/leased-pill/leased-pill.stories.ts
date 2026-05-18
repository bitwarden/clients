import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { LeasedPillComponent } from "./leased-pill.component";

const now = Date.now();

export default {
  title: "Web/PAM/Leased Pill",
  component: LeasedPillComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              leasedPillActiveLabel: "Leased — expires in __$1__",
              leasedPillActiveTooltip: "Active lease — expires in __$1__. Click to request extension.",
              leasedPillExtensionPendingLabel: "Extension pending",
              leasedPillExtensionPendingTooltip: "Extension request submitted. Awaiting approval.",
            }),
        },
      ],
    }),
  ],
} as Meta<LeasedPillComponent>;

type Story = StoryObj<LeasedPillComponent>;

export const ActiveLongRemaining: Story = {
  args: {
    notAfter: new Date(now + 47 * 60 * 1000).toISOString(),
    extensionPending: false,
  },
};

export const ActiveSecondsLeft: Story = {
  args: {
    notAfter: new Date(now + 28 * 1000).toISOString(),
    extensionPending: false,
  },
};

export const ActiveExpired: Story = {
  args: {
    notAfter: new Date(now - 5_000).toISOString(),
    extensionPending: false,
  },
};

export const ExtensionPending: Story = {
  args: {
    notAfter: new Date(now + 15 * 60 * 1000).toISOString(),
    extensionPending: true,
  },
};
