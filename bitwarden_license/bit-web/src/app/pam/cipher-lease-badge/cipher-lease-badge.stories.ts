import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { CipherLeaseBadgeComponent } from "./cipher-lease-badge.component";

export default {
  title: "Web/PAM/Cipher Lease Badge",
  component: CipherLeaseBadgeComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              cipherLeaseRequiresApproval: "Requires approval to view",
              cipherLeaseExpiresIn: "Leased — expires in __$1__",
            }),
        },
      ],
    }),
  ],
} as Meta<CipherLeaseBadgeComponent>;

type Story = StoryObj<CipherLeaseBadgeComponent>;

export const Unleased: Story = {
  args: {
    state: "unleased",
  },
};

export const GatedNoLease: Story = {
  args: {
    state: "gated_no_lease",
  },
};

export const GatedActiveLease_LongLeft: Story = {
  args: {
    state: "gated_active_lease",
    leaseExpiresAt: new Date(Date.now() + 47 * 60 * 1000),
  },
};

export const GatedActiveLease_SecondsLeft: Story = {
  args: {
    state: "gated_active_lease",
    leaseExpiresAt: new Date(Date.now() + 15 * 1000),
  },
};
