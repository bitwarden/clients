import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AccessBadgeState } from "./access-badge-state";
import { AccessStateBadgeComponent } from "./access-state-badge.component";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Built at render time, not module load, since the `active` recipe depends on the clock. */
function expiringIn(ms: number): AccessBadgeState {
  return { kind: "active", expiresAt: new Date(Date.now() + ms) };
}

export default {
  title: "Web/PAM/Access State Badge",
  component: AccessStateBadgeComponent,
  decorators: [
    moduleMetadata({
      // Imported as well as set as `component` so the AllStates template can render it.
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
  args: {
    state: { kind: "privileged" },
  },
} as Meta<AccessStateBadgeComponent>;

type Story = StoryObj<AccessStateBadgeComponent>;

/** Governed by an access rule, with nothing requested. */
export const Privileged: Story = {
  args: { state: { kind: "privileged" } },
};

export const Pending: Story = {
  args: { state: { kind: "pending" } },
};

/** Approved, but the requester has not started the lease yet. */
export const Ready: Story = {
  args: { state: { kind: "ready" } },
};

/** Over an hour left, so the label changes once a minute and stays stable for snapshots. */
export const Active: Story = {
  render: () => ({ props: { state: expiringIn(2 * HOUR + 5 * MINUTE) } }),
};

/** Five minutes or less left escalates to danger, from the same `active` state. */
export const EndingSoon: Story = {
  render: () => ({ props: { state: expiringIn(4 * MINUTE) } }),
};

/**
 * Under a minute the label counts seconds and changes every tick, so snapshots are off;
 * {@link EndingSoon} covers the same recipe.
 */
export const EndingSoonSeconds: Story = {
  render: () => ({ props: { state: expiringIn(45 * 1000) } }),
  parameters: { chromatic: { disableSnapshot: true } },
};

/** Part of the badge model, though `cipherAccessBadgeState` never produces it. */
export const Expired: Story = {
  args: { state: { kind: "expired" } },
};

/** Held by another user. Like {@link Expired}, never produced by `cipherAccessBadgeState`. */
export const Unavailable: Story = {
  args: { state: { kind: "unavailable" } },
};

/** An `active` state past its `expiresAt` renders "Access ended", not a negative countdown. */
export const LapsedLease: Story = {
  render: () => ({ props: { state: expiringIn(-1 * MINUTE) } }),
};

/** A `null` state renders nothing rather than an empty pill. */
export const NotGated: Story = {
  args: { state: null },
};

/** Every recipe side by side, for checking a colour, icon or escalation change. */
export const AllStates: Story = {
  render: () => ({
    props: {
      rows: [
        { name: "privileged", state: { kind: "privileged" } },
        { name: "pending", state: { kind: "pending" } },
        { name: "ready", state: { kind: "ready" } },
        { name: "active", state: expiringIn(2 * HOUR + 5 * MINUTE) },
        { name: "active (≤ 5m)", state: expiringIn(4 * MINUTE) },
        { name: "expired", state: { kind: "expired" } },
        { name: "unavailable", state: { kind: "unavailable" } },
      ],
    },
    template: /*html*/ `
      <div class="tw-flex tw-flex-col tw-gap-3">
        @for (row of rows; track row.name) {
          <div class="tw-flex tw-items-center tw-gap-3">
            <code class="tw-w-36 tw-shrink-0 tw-text-xs tw-text-muted">{{ row.name }}</code>
            <app-pam-access-state-badge [state]="row.state" />
          </div>
        }
      </div>
    `,
  }),
};
