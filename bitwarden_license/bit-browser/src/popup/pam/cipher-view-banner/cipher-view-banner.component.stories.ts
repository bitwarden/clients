import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { EMPTY, of } from "rxjs";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
} from "@bitwarden/bit-common/pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import { CipherViewBannerComponent } from "./cipher-view-banner.component";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ORGANIZATION_ID = "org-1";

/** An instant relative to render time. */
function fromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** The caller's membership, with their Privileged Controls seat under the story's control. */
function organization(licensed: boolean): Organization {
  return Object.assign(new Organization(), {
    id: ORGANIZATION_ID,
    enabled: true,
    usePam: true,
    accessPam: licensed,
    isProviderUser: false,
  });
}

/** A gated cipher: `partial` is what marks it as governed and still unrevealed. */
function gatedCipher(): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Prod database";
  cipher.partial = true;
  // Only an organization-owned cipher can be governed, and it is the organization the licensing
  // check reads the caller's seat from.
  cipher.organizationId = ORGANIZATION_ID;
  return cipher;
}

/** A cipher already being served under a lease: no longer partial, but still PAM-governed. */
function leasedCipher(): CipherView {
  const cipher = gatedCipher();
  cipher.partial = false;
  cipher.leaseGated = true;
  return cipher;
}

type AccessState = Record<string, unknown> | null;

/**
 * A running lease with `remainingMs` left, plus the badge the SDK would rank for it. Both read one
 * instant, so the countdown and the badge cannot describe different moments.
 */
function activeLeaseState(remainingMs: number, extensionsAllowed: boolean): () => AccessState {
  return () => {
    const notAfter = fromNow(remainingMs);
    return {
      badgeState: { active: { expiresAt: notAfter } },
      activeLease: { id: "lease-1", notAfter },
      extensionsAllowed,
    };
  };
}

/**
 * The banner ticks its own clock, so `state` is a factory and its windows are built against the
 * real clock at render time.
 */
function pam(
  options: {
    state?: () => AccessState;
    mode?: "automatic" | "human";
    enabled?: boolean;
    maxDurationSeconds?: number;
    /** The caller's own Privileged Controls seat; licensed by default. */
    licensed?: boolean;
  } = {},
) {
  const {
    state,
    mode = "automatic",
    enabled = true,
    maxDurationSeconds = 4 * 60 * 60,
    licensed = true,
  } = options;
  return moduleMetadata({
    imports: [CipherViewBannerComponent],
    providers: [
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(enabled) } },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: OrganizationService,
        useValue: { organizations$: () => of([organization(licensed)]) },
      },
      {
        provide: AccessRequestSdkService,
        useValue: {
          getCipherAccessState: () => Promise.resolve(state?.() ?? null),
          preCheck: () =>
            Promise.resolve({
              approvalMode: mode,
              hasActiveLease: false,
              maxDurationSeconds,
              defaultDurationSeconds: 60 * 60,
            }),
          activateAccessRequest: () => Promise.resolve({}),
          cancelAccessRequest: () => Promise.resolve(),
        },
      },
      {
        provide: AccessLeaseSdkService,
        useValue: { extendLease: () => Promise.resolve({}), endLease: () => Promise.resolve() },
      },
      {
        provide: AccessRefreshService,
        useValue: { accessChanged$: () => EMPTY, notifyAccessChanged: () => {} },
      },
      {
        provide: DialogService,
        useValue: {
          openSimpleDialog: () => Promise.resolve(false),
          open: () => ({ closed: of(undefined) }),
        },
      },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Browser/PAM/Cipher View Banner",
  component: CipherViewBannerComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: LogService, useValue: { error: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamAccessBadgeEndingSoon: (duration) => `Ending soon • ${duration} left`,
              pamAccessBadgeTimeLeft: (duration) => `${duration} left`,
              pamActiveAccessBannerEndingSoonHeading: "Access to this item is ending soon",
              pamActiveAccessBannerHeading: "You have active access to this item",
              pamApprovedRequestBannerDuration: (duration) => `${duration} of access`,
              pamApprovedRequestBannerHeading: "Access approved",
              pamCipherViewSectionHeader: "Privileged access",
              pamEndLeaseButton: "End access",
              pamExtendLeaseButton: "Extend",
              pamPendingRequestBannerHeading: "Access request pending approval",
              pamRequestAccessBannerBody: "Credentials are masked until access is granted.",
              pamRequestAccessBannerHeading: "You can request access",
              pamRequestAccessBannerMaxDuration: (duration) => `Access up to ${duration}`,
              pamRequestAccessBannerMaxDurationAutomatic: (duration) =>
                `Access up to ${duration}, instant approval if you meet the conditions`,
              pamRequestAccessButton: "Request access",
              pamStartLeaseButton: "Start access",
              pamUnlicensedBannerBody:
                "You need a Privileged Controls license to view this item. Ask your admin to activate your license.",
              pamUnlicensedBannerHeading: "Privileged Controls license required",
              pamUnlicensedBannerRequestUnavailable:
                "Requesting access is not available while unlicensed.",
              pamWindowFrom: (date) => `From ${date}`,
              pamWindowUntil: (date) => `Until ${date}`,
              pendingStateCancelRequest: "Cancel request",
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
  args: { cipher: gatedCipher() },
  /** Rendered at the popup's 380px width, on the popup page's background and gutter. */
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-box-border tw-w-[380px] tw-bg-background-alt tw-px-3 tw-py-3">
        <app-pam-cipher-view-banner [cipher]="cipher" />
      </div>
    `,
  }),
} as Meta<CipherViewBannerComponent>;

type Story = StoryObj<CipherViewBannerComponent>;

/**
 * The resting entry point under an auto-approving rule: the card carries the rule's cap and the
 * instant-approval clause.
 */
export const Privileged: Story = {
  decorators: [pam({ state: () => ({ badgeState: "privileged" }) })],
};

/** The same entry point against a rule that requires human approval: the cap alone. */
export const PrivilegedHumanApproval: Story = {
  decorators: [
    pam({
      state: () => ({ badgeState: "privileged" }),
      mode: "human",
      maxDurationSeconds: 24 * 60 * 60,
    }),
  ],
};

/**
 * The licensing block. It comes first and replaces every other state, active lease included, because
 * the server stops releasing the credential to an unlicensed holder whatever lease they hold.
 */
export const Unlicensed: Story = {
  decorators: [pam({ state: () => ({ badgeState: "privileged" }), licensed: false })],
};

/** The licensing block in front of a running lease. */
export const UnlicensedWithActiveLease: Story = {
  args: { cipher: leasedCipher() },
  decorators: [pam({ licensed: false, state: activeLeaseState(90 * MINUTE, true) })],
};

/** The licensing block still renders when the access state cannot be read. */
export const UnlicensedStateUnreadable: Story = {
  decorators: [pam({ licensed: false, state: () => null })],
};

/** An access state that cannot be read renders nothing, section header included. */
export const StateUnreadable: Story = {
  decorators: [pam({ state: () => null })],
};

/** The request is with an approver, and can still be withdrawn. */
export const PendingRequest: Story = {
  decorators: [
    pam({
      state: () => ({
        badgeState: "pending",
        pendingRequest: {
          id: "request-1",
          leaseNotBefore: fromNow(0),
          leaseNotAfter: fromNow(HOUR),
        },
      }),
    }),
  ],
};

/** Approved and not yet started, inside its window already. */
export const ApprovedReadyToStart: Story = {
  decorators: [
    pam({
      state: () => ({
        badgeState: "ready",
        approvedRequest: {
          id: "request-1",
          status: "approved",
          leaseNotBefore: fromNow(0),
          leaseNotAfter: fromNow(2 * HOUR),
        },
      }),
    }),
  ],
};

/** Approved for a later window, so both bounds are shown. */
export const ApprovedWindowNotOpenYet: Story = {
  decorators: [
    pam({
      mode: "human",
      state: () => ({
        badgeState: "ready",
        approvedRequest: {
          id: "request-1",
          status: "approved",
          leaseNotBefore: fromNow(20 * HOUR),
          leaseNotAfter: fromNow(23 * HOUR),
        },
      }),
    }),
  ],
};

/** A running lease, countdown ticking, under a rule that allows extensions. */
export const ActiveLease: Story = {
  args: { cipher: leasedCipher() },
  decorators: [pam({ state: activeLeaseState(90 * MINUTE, true) })],
};

/**
 * The same lease inside `ENDING_SOON_THRESHOLD_MS`. The name-row badge is suppressed on this
 * surface, so this heading is the only countdown present and has to carry the warning itself.
 */
export const ActiveLeaseEndingSoon: Story = {
  args: { cipher: leasedCipher() },
  decorators: [pam({ state: activeLeaseState(4 * MINUTE, true) })],
};

/** The same lease under a rule that forbids extensions: only End access is offered. */
export const ActiveLeaseNoExtensions: Story = {
  args: { cipher: leasedCipher() },
  decorators: [pam({ state: activeLeaseState(20 * MINUTE, false) })],
};

/** With the PAM flag off the banner renders nothing, whatever the cipher is. */
export const FeatureFlagOff: Story = {
  decorators: [pam({ enabled: false, state: () => ({ badgeState: "privileged" }) })],
};
