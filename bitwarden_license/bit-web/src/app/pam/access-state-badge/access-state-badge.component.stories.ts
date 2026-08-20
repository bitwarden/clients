import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AccessBadgeState } from "./access-badge-state";
import { AccessStateBadgeComponent } from "./access-state-badge.component";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * `active` is the only state whose recipe depends on the clock, so `expiresAt` is built at render
 * time rather than at module load — a story left open would otherwise drift past its own expiry and
 * silently fall back to the "Session ended" recipe.
 */
function expiringIn(ms: number): AccessBadgeState {
  return { kind: "active", expiresAt: new Date(Date.now() + ms) };
}

export default {
  title: "Web/PAM/Access State Badge",
  component: AccessStateBadgeComponent,
  decorators: [
    moduleMetadata({
      // Imported (not just declared as `component`) so the gallery story can render it from a template.
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
              pamAccessBadgeSessionEnded: "Session ended",
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

/** The resting state: the item is governed by an access rule but nothing has been requested. */
export const Privileged: Story = {
  args: { state: { kind: "privileged" } },
};

/** A request is in with an approver and has not been decided. */
export const Pending: Story = {
  args: { state: { kind: "pending" } },
};

/** Approved but not yet activated — the requester still has to start the lease. */
export const Ready: Story = {
  args: { state: { kind: "ready" } },
};

/**
 * A running lease with comfortable time left. The label re-renders every second; the formatted
 * value only changes once a minute, so it is stable well beyond a visual-regression capture.
 */
export const Active: Story = {
  render: () => ({ props: { state: expiringIn(2 * HOUR + 5 * MINUTE) } }),
};

/**
 * At or below five minutes remaining the badge escalates from accent to danger. The threshold is a
 * function of the live countdown, not a separate state — the caller passes the same `active`.
 */
export const EndingSoon: Story = {
  render: () => ({ props: { state: expiringIn(4 * MINUTE) } }),
};

/**
 * Under a minute the countdown switches to seconds, so this label really does change on every tick.
 * Snapshots are off for that reason; {@link EndingSoon} covers the same recipe deterministically.
 */
export const EndingSoonSeconds: Story = {
  render: () => ({ props: { state: expiringIn(45 * 1000) } }),
  parameters: { chromatic: { disableSnapshot: true } },
};

/**
 * A finished session. Not currently reachable through `cipherAccessBadgeState` — the SDK has no
 * field to derive it from — but part of the badge model, so the recipe is pinned here.
 */
export const Expired: Story = {
  args: { state: { kind: "expired" } },
};

/**
 * The item is held by another user. Like {@link Expired}, modelled but not yet produced by
 * `cipherAccessBadgeState`; it shares the muted lock recipe and differs only in copy.
 */
export const Unavailable: Story = {
  args: { state: { kind: "unavailable" } },
};

/**
 * An `active` lease whose `expiresAt` has already passed locally, before any refetch. The component
 * falls back to the resting "Session ended" recipe rather than rendering a negative countdown.
 */
export const LapsedLease: Story = {
  render: () => ({ props: { state: expiringIn(-1 * MINUTE) } }),
};

/** A `null` state — an ungated item — renders nothing at all rather than an empty pill. */
export const NotGated: Story = {
  args: { state: null },
};

/**
 * Every recipe side by side. This is the view to check when changing a colour, icon, or the
 * five-minute escalation, since the point of the component is that all surfaces agree.
 */
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
