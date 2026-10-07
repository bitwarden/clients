import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DialogService, ToastService } from "@bitwarden/components";
import { featureFlagModes } from "@bitwarden/storybook";
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

/** The tab ticks against the real clock, so these windows are built at render time. */
function content() {
  const pending = [
    // Approved and ready to activate: renders in the active-access section, badged "Ready to use".
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

/** All three sections populated; the startable grant sits with the leases, not under Pending. */
export const Default: Story = {
  decorators: [myAccess()],
  parameters: { chromatic: { modes: featureFlagModes(FeatureFlag.VFO1Foundation) } },
};

export const FlagOn: Story = {
  decorators: [myAccess()],
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
};

/**
 * A Collection filter applied on the `bit-table-v2` path, which shows the toolbar's applied state
 * and narrows the other two sections from outside its table.
 */
export const FlagOnFiltered: Story = {
  decorators: [myAccess()],
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
  play: async ({ canvasElement }) => {
    const trigger = await within(canvasElement).findByRole("button", { name: /^Collection/ });
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByText("Production"));
    await userEvent.keyboard("{Escape}");
  },
};

/** Pending and Active access show empty states; Extension requests renders nothing. */
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
 * Badged "Approved" rather than "Ready to use", but Start is still offered so the requester can try
 * and see the server's refusal.
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

/**
 * A grant that lapsed while the tab was open stays in Active access until the next load, badged
 * "Expired" with no action, below the held lease.
 */
export const ApprovedWindowLapsed: Story = {
  decorators: [
    myAccess({
      content: () => ({
        pending: [
          toRequestRow(
            accessRequest({
              id: "req-lapsed",
              status: "approved",
              leaseNotBefore: liveFromNow(-2 * HOUR),
              leaseNotAfter: liveFromNow(-HOUR),
              resolvedAt: liveFromNow(-3 * HOUR),
            }),
            names,
          ),
        ],
        extensions: [],
        leases: [
          toLeaseRow(
            accessLease({
              notBefore: liveFromNow(-15 * MINUTE),
              notAfter: liveFromNow(20 * MINUTE),
            }),
            names,
          ),
        ],
      }),
    }),
  ],
};
