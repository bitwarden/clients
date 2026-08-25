import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  DAY,
  HOUR,
  MINUTE,
  accessLease,
  accessRequest,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { toLeaseRow, toRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const names = storyNames();

/**
 * This tab ticks its own `Date.now()` signal for the redemption and remaining countdowns, so every
 * window is built against the real clock when the story renders — a fixed timestamp would arrive
 * already elapsed and every row would render as expired.
 */
function content() {
  const pending = [
    // Approved and ready to activate: the Start button is live.
    toRequestRow(
      accessRequest({
        id: "req-approved",
        status: "approved",
        leaseNotBefore: liveFromNow(0),
        leaseNotAfter: liveFromNow(HOUR),
        resolvedAt: liveFromNow(-5 * MINUTE),
      }),
      names,
    ),
    // Still awaiting a decision: cancellable, but nothing to start yet.
    toRequestRow(
      accessRequest({
        id: "req-pending",
        cipherId: "cipher-2",
        collectionId: "col-2",
        leaseNotBefore: liveFromNow(2 * HOUR),
        leaseNotAfter: liveFromNow(6 * HOUR),
        reason: "Scheduled migration window.",
      }),
      names,
    ),
  ];

  const extensions = [
    toRequestRow(
      accessRequest({
        id: "req-extension",
        extensionOfLeaseId: "lease-1",
        leaseNotBefore: liveFromNow(0),
        leaseNotAfter: liveFromNow(2 * HOUR),
        reason: "Migration is still running.",
      }),
      names,
    ),
  ];

  const leases = [
    toLeaseRow(
      accessLease({ notBefore: liveFromNow(-15 * MINUTE), notAfter: liveFromNow(45 * MINUTE) }),
      names,
    ),
    // A lease that has already been extended once, badged with the time added.
    toLeaseRow(
      accessLease({
        id: "lease-2",
        requestId: "req-2",
        cipherId: "cipher-2",
        collectionId: "col-2",
        notBefore: liveFromNow(-2 * HOUR),
        notAfter: liveFromNow(3 * HOUR),
      }),
      names,
      { addedSeconds: 2 * 60 * 60, latestEndMs: Date.now() + 3 * HOUR },
    ),
  ];

  return { pending, extensions, leases };
}

function myAccess(
  options: {
    content?: () => ReturnType<typeof content>;
    loading?: boolean;
  } = {},
) {
  const { content: build = content, loading = false } = options;
  return moduleMetadata({
    imports: [MyRequestsTabComponent],
    providers: [
      {
        provide: MyAccessService,
        useFactory: () => {
          const { pending, extensions, leases } = build();
          return {
            loading$: of(loading),
            loadError$: of(null),
            pendingRows$: of(pending),
            extensionRows$: of(extensions),
            leases$: of(leases),
            historyRows$: of([]),
            cipherById$: of(names.cipherById),
            load: () => Promise.resolve(),
            cancel: () => Promise.resolve(),
            activate: () => Promise.resolve(),
            endLease: () => Promise.resolve(),
          };
        },
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

const empty = (): ReturnType<typeof content> => ({ pending: [], extensions: [], leases: [] });

export default {
  title: "Web/PAM/Access Requests/My Requests Tab",
  component: MyRequestsTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<pam-my-requests-tab />` }),
} as Meta<MyRequestsTabComponent>;

type Story = StoryObj<MyRequestsTabComponent>;

/** All three sections populated: a startable grant, a pending request, an extension, two leases. */
export const Default: Story = {
  decorators: [myAccess()],
};

/**
 * Nothing outstanding. Pending and Currently checked out carry their own empty state; Extension
 * requests renders nothing at all — it never shows once `extensionRows()` is empty.
 */
export const Empty: Story = {
  decorators: [myAccess({ content: empty })],
};

/** Only an active lease, with the remaining-time countdown running. */
export const ActiveLeaseOnly: Story = {
  decorators: [
    myAccess({
      content: () => ({
        pending: [],
        extensions: [],
        leases: [
          toLeaseRow(
            accessLease({
              notBefore: liveFromNow(-10 * MINUTE),
              notAfter: liveFromNow(20 * MINUTE),
            }),
            names,
          ),
        ],
      }),
    }),
  ],
};

/**
 * An approved grant whose window has not opened yet: it cannot be started, so the row shows when it
 * becomes redeemable rather than an inert Start button.
 */
export const ApprovedNotYetRedeemable: Story = {
  decorators: [
    myAccess({
      content: () => ({
        pending: [
          toRequestRow(
            accessRequest({
              id: "req-future",
              status: "approved",
              leaseNotBefore: liveFromNow(DAY),
              leaseNotAfter: liveFromNow(DAY + 2 * HOUR),
              resolvedAt: liveFromNow(-MINUTE),
            }),
            names,
          ),
        ],
        extensions: [],
        leases: [],
      }),
    }),
  ],
};
