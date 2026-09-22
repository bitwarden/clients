import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { AccessBadgeState } from "@bitwarden/bit-common/pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AccessStateBadgeComponent } from "./access-state-badge.component";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** An `active` state ending `ms` from now. */
function expiringIn(ms: number): AccessBadgeState {
  return { kind: "active", expiresAt: new Date(Date.now() + ms) };
}

export default {
  title: "Browser/PAM/Access State Badge",
  component: AccessStateBadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [AccessStateBadgeComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamAccessBadgePrivileged: "Privileged",
              pamAccessBadgePending: "Pending approval",
              pamAccessBadgeUnavailable: "Unavailable",
              pamAccessBadgeReady: "Ready to use",
              pamAccessBadgeEnded: "Access ended",
              pamAccessBadgeTimeLeft: (duration) => `${duration} left`,
              pamAccessBadgeEndingSoon: (duration) => `Ending soon • ${duration} left`,
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
  args: {
    state: { kind: "privileged" },
  },
} as Meta<AccessStateBadgeComponent>;

type Story = StoryObj<AccessStateBadgeComponent>;

/** The resting state: the item is governed by an access rule but nothing has been requested. */
export const Privileged: Story = {
  args: { state: { kind: "privileged" } },
};

/** A request is in with an approver and has not been decided. */
export const Pending: Story = {
  args: { state: { kind: "pending" } },
};

/** Approved but not yet activated: the requester still has to start the lease. */
export const Ready: Story = {
  args: { state: { kind: "ready" } },
};

/** A running lease with time left. */
export const Active: Story = {
  args: { state: expiringIn(2 * HOUR + 5 * MINUTE) },
};

/** Inside the shared `ENDING_SOON_THRESHOLD_MS` cutoff, where the pill escalates to danger. */
export const EndingSoon: Story = {
  args: { state: expiringIn(4 * MINUTE) },
};

/** Access has ended. */
export const Expired: Story = {
  args: { state: { kind: "expired" } },
};

/** Part of the shared model; `cipherAccessBadgeState()` never produces it. */
export const Unavailable: Story = {
  args: { state: { kind: "unavailable" } },
};

/** Nothing renders when there is no state, including no placeholder. */
export const NoState: Story = {
  args: { state: null },
};

/** Every pill together, to compare the recipes at the popup's own width. */
export const Gallery: Story = {
  render: () => ({
    props: {
      privileged: { kind: "privileged" },
      pending: { kind: "pending" },
      ready: { kind: "ready" },
      active: expiringIn(2 * HOUR + 5 * MINUTE),
      endingSoon: expiringIn(4 * MINUTE),
      expired: { kind: "expired" },
      unavailable: { kind: "unavailable" },
    },
    template: `
      <div class="tw-w-[380px] tw-flex tw-flex-wrap tw-gap-2 tw-p-2">
        <app-pam-access-state-badge [state]="privileged" />
        <app-pam-access-state-badge [state]="pending" />
        <app-pam-access-state-badge [state]="ready" />
        <app-pam-access-state-badge [state]="active" />
        <app-pam-access-state-badge [state]="endingSoon" />
        <app-pam-access-state-badge [state]="expired" />
        <app-pam-access-state-badge [state]="unavailable" />
      </div>
    `,
  }),
};
