import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { NEVER, of } from "rxjs";
import { fireEvent, userEvent, within } from "storybook/test";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { DialogService } from "@bitwarden/components";
import { featureFlagModes } from "@bitwarden/storybook";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";
import {
  DAY,
  HOUR,
  MINUTE,
  fromNow,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { AccessAuditComponent } from "./access-audit.component";
import { AuditApiService, AuditTrailPage } from "./audit-api.service";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

const names = storyNames();

function event(overrides: Record<string, unknown>): AccessAuditEventResponse {
  return {
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-HOUR),
    organizationId: "org-1",
    actorId: "user-1",
    actorName: "Grace Hopper",
    actorEmail: "grace@example.com",
    requesterId: "user-1",
    requesterName: "Grace Hopper",
    requesterEmail: "grace@example.com",
    collectionId: "col-1",
    cipherId: "cipher-1",
    requestId: "req-1",
    leaseId: null,
    ruleId: null,
    detail: null,
    leaseNotBefore: null,
    leaseNotAfter: null,
    cipherName: null,
    collectionName: null,
    ruleName: null,
    targetSystemName: null,
    accessConnectorName: null,
    automated: false,
    incomplete: false,
    ...overrides,
  } as unknown as AccessAuditEventResponse;
}

/** Distinct from both requesters, so the Actor and Requester chips each have options to sort. */
const APPROVER = {
  actorId: "user-2",
  actorName: "Ada Lovelace",
  actorEmail: "ada@example.com",
};

/** The second requester, so the Requester chip is not a one-option menu. */
const OTHER_REQUESTER = {
  requesterId: "user-3",
  requesterName: "Katherine Johnson",
  requesterEmail: "katherine@example.com",
};

/** Newest first, as the server returns them, spread over a week. */
const EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-5 * MINUTE),
    leaseId: "lease-1",
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.LeaseRevoked,
    occurredAt: fromNow(-20 * MINUTE),
    leaseId: "lease-2",
    ...APPROVER,
    detail: "Incident closed early.",
  }),
  event({
    kind: AccessAuditEventKind.LeaseExtended,
    occurredAt: fromNow(-45 * MINUTE),
    leaseId: "lease-1",
    leaseNotAfter: fromNow(-5 * MINUTE),
  }),
  event({
    kind: AccessAuditEventKind.LeaseActivated,
    occurredAt: fromNow(-2 * HOUR),
    leaseId: "lease-1",
    leaseNotBefore: fromNow(-2 * HOUR),
    leaseNotAfter: fromNow(-30 * MINUTE),
  }),
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-3 * HOUR),
    ...APPROVER,
    detail: "Approved for the incident window.",
  }),
  // Auto-approved by the rule, so there is no actor.
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-2 * DAY),
    cipherId: "cipher-2",
    collectionId: "col-2",
    requestId: "req-2",
    ...OTHER_REQUESTER,
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-2 * DAY - HOUR),
    cipherId: "cipher-2",
    collectionId: "col-2",
    requestId: "req-2",
    ...OTHER_REQUESTER,
    actorId: OTHER_REQUESTER.requesterId,
    actorName: OTHER_REQUESTER.requesterName,
    actorEmail: OTHER_REQUESTER.requesterEmail,
  }),
  event({
    kind: AccessAuditEventKind.RequestDenied,
    occurredAt: fromNow(-4 * DAY),
    cipherId: "cipher-3",
    ...APPROVER,
    detail: "Use the read replica instead.",
  }),
  event({ kind: AccessAuditEventKind.RequestCancelled, occurredAt: fromNow(-5 * DAY) }),
  // No cipher, so the Item cell falls back to the rule name.
  event({
    kind: AccessAuditEventKind.RuleUpdated,
    occurredAt: fromNow(-7 * DAY),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-1",
    ruleName: "Production access",
    ...APPROVER,
  }),
];

/** Rotation and fleet events; those naming no cipher fall through to the connector or target. */
const ROTATION_EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.RotationSucceeded,
    occurredAt: fromNow(-2 * MINUTE),
    requestId: null,
    actorId: null,
    actorName: null,
    actorEmail: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    accessConnectorName: "eu-west-rotator",
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.RotationAttemptFailed,
    occurredAt: fromNow(-8 * MINUTE),
    requestId: null,
    actorId: null,
    actorName: null,
    actorEmail: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    accessConnectorName: "eu-west-rotator",
    detail: "Connection refused; 2 attempts left.",
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.AccessConnectorAssignedToTarget,
    occurredAt: fromNow(-25 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    targetSystemName: "prod-postgres-01",
    accessConnectorName: "eu-west-rotator",
    ...APPROVER,
  }),
  event({
    kind: AccessAuditEventKind.TargetSystemRenamed,
    occurredAt: fromNow(-70 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    targetSystemName: "prod-postgres-01",
    detail: "Renamed from 'pg-primary'.",
    ...APPROVER,
  }),
  event({
    kind: AccessAuditEventKind.RotationConfigCreated,
    occurredAt: fromNow(-4 * HOUR),
    requestId: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    targetSystemName: "prod-postgres-01",
    ...APPROVER,
  }),
];

/**
 * A rule name past sixty characters, and a token longer than the column cap, which must break
 * mid-word.
 */
const LONG_TEXT_EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.RuleDeleted,
    occurredAt: fromNow(-10 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-2",
    ruleName:
      "Emergency database credential rotation access for the platform reliability engineering on-call team",
    ...APPROVER,
  }),
  event({
    kind: AccessAuditEventKind.LeaseRevoked,
    occurredAt: fromNow(-30 * MINUTE),
    leaseId: "lease-3",
    ...APPROVER,
    detail:
      "Revoked ahead of the scheduled expiry after the on-call engineer confirmed the primary replica had recovered and the failover procedure completed without needing the elevated credential.",
  }),
  event({
    kind: AccessAuditEventKind.RequestDenied,
    occurredAt: fromNow(-90 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-3",
    ruleName:
      "https://runbooks.internal.example.com/database/emergency-credential-rotation-procedure-v4-approved-2026",
    ...APPROVER,
    detail:
      "correlationid=AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNNOOOOPPPPQQQQRRRRSSSSTTTT",
  }),
];

/** Leaves out `user-9`, a removed member the trail still names. */
const MEMBERS = [
  { userId: "user-1", id: "org-user-1", name: "Grace Hopper", email: "grace@example.com" },
  { userId: "user-2", id: "org-user-2", name: "Ada Lovelace", email: "ada@example.com" },
  { userId: "user-3", id: "org-user-3", name: "Katherine Johnson", email: "katherine@example.com" },
];

/** A member who has left the organization, so the member lookup cannot resolve them. */
const FORMER_MEMBER = {
  actorId: "user-9",
  actorName: "Alan Turing",
  actorEmail: "alan@example.com",
  requesterId: "user-9",
  requesterName: "Alan Turing",
  requesterEmail: "alan@example.com",
};

const MIXED_LINK_EVENTS: AccessAuditEventResponse[] = [
  // Every cell links: a resolved actor and requester, and an item this vault decrypted.
  event({
    kind: AccessAuditEventKind.CredentialAccessed,
    occurredAt: fromNow(-5 * MINUTE),
    ...APPROVER,
  }),
  // The Actor cell reads System, which is never a link.
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-15 * MINUTE),
    leaseId: "lease-1",
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  // A former member, so both names stay text.
  event({
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-40 * MINUTE),
    ...FORMER_MEMBER,
  }),
  // The Item cell shows the rule name, which has no event history to open.
  event({
    kind: AccessAuditEventKind.RuleUpdated,
    occurredAt: fromNow(-3 * HOUR),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-1",
    ruleName: "Production access",
    ...APPROVER,
  }),
  // An item outside this viewer's vault, so there is no name to link.
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-DAY),
    cipherId: "cipher-9",
    collectionId: "col-9",
    requestId: "req-9",
    ...OTHER_REQUESTER,
    ...APPROVER,
  }),
];

const EMPTY_FIELD_EVENTS: AccessAuditEventResponse[] = [
  // Nothing but a time and a kind.
  event({
    kind: AccessAuditEventKind.LeasingFreezeEnabled,
    occurredAt: fromNow(-5 * MINUTE),
    actorId: null,
    actorName: null,
    actorEmail: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    cipherId: null,
    collectionId: null,
    requestId: null,
  }),
  // Automated with every other field empty, so only the Actor cell has a value.
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-25 * MINUTE),
    leaseId: "lease-4",
    actorId: null,
    actorName: null,
    actorEmail: null,
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    cipherId: null,
    collectionId: null,
    requestId: null,
    automated: true,
  }),
  // An actor but no requester or detail.
  event({
    kind: AccessAuditEventKind.RuleCreated,
    occurredAt: fromNow(-2 * HOUR),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-4",
    ruleName: "Production access",
    requesterId: null,
    requesterName: null,
    requesterEmail: null,
    ...APPROVER,
  }),
  // A full row, so a regression that dashes a value shows as plainly as a missing dash.
  event({
    kind: AccessAuditEventKind.LeaseActivated,
    occurredAt: fromNow(-3 * HOUR),
    leaseId: "lease-5",
    leaseNotBefore: fromNow(-3 * HOUR),
    leaseNotAfter: fromNow(-HOUR),
    ...APPROVER,
    detail: "Approved for the incident window.",
  }),
];

/**
 * Stamped against the real clock, since the Time period presets measure from `Date.now()` and a
 * {@link fromNow} fixture is anchored to a fixed past instant.
 */
function liveEvents(): AccessAuditEventResponse[] {
  return [
    event({ kind: AccessAuditEventKind.CredentialAccessed, occurredAt: liveFromNow(-HOUR) }),
    event({
      kind: AccessAuditEventKind.LeaseRevoked,
      occurredAt: liveFromNow(-2 * DAY),
      leaseId: "lease-2",
      ...APPROVER,
      detail: "Incident closed early.",
    }),
    event({
      kind: AccessAuditEventKind.RequestApproved,
      occurredAt: liveFromNow(-20 * DAY),
      cipherId: "cipher-2",
      collectionId: "col-2",
      ...OTHER_REQUESTER,
    }),
    event({
      kind: AccessAuditEventKind.RequestSubmitted,
      occurredAt: liveFromNow(-60 * DAY),
      cipherId: "cipher-3",
      ...OTHER_REQUESTER,
    }),
  ];
}

/** The chip's menu renders in a CDK overlay on `document.body`, outside the story's canvas. */
async function selectChipOption(
  canvasElement: HTMLElement,
  chip: string,
  option: string,
): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    `bit-filter-menu button[title^="${chip}"]`,
  )!;
  await userEvent.click(trigger);
  await userEvent.click(await within(document.body).findByText(option));
  // Close the multi-select, or the next chip's click lands on this menu's backdrop.
  await userEvent.keyboard("{Escape}");
}

function audit(
  options: {
    events?: AccessAuditEventResponse[];
    fails?: boolean;
    refreshPending?: boolean;
    drawerStaysOpen?: boolean;
  } = {},
) {
  const {
    events = EVENTS,
    fails = false,
    refreshPending = false,
    drawerStaysOpen = false,
  } = options;
  return moduleMetadata({
    imports: [AccessAuditComponent],
    providers: [
      {
        provide: AuditApiService,
        // A factory, so the read counter behind `refreshPending` restarts on every mount.
        useFactory: () => {
          let reads = 0;
          return {
            listAccessAuditTrail: () => {
              reads += 1;
              if (fails) {
                return Promise.reject(new Error("audit read failed"));
              }
              // One page; these stories cover rendering, not paging.
              return refreshPending && reads > 1
                ? new Promise<AuditTrailPage>(() => undefined)
                : Promise.resolve({ data: events, continuationToken: null });
            },
            // Left empty, since these stories cover how the trail renders.
            listAccessAuditItems: () => Promise.resolve([]),
          };
        },
      },
      {
        provide: AccessNameResolverService,
        useValue: { resolveNames: () => Promise.resolve(names) },
      },
      {
        provide: OrganizationUserApiService,
        useValue: {
          getAllMiniUserDetails: () => Promise.resolve({ data: MEMBERS }),
        },
      },
      {
        provide: DialogService,
        useValue: {
          open: () => ({ closed: of(undefined) }),
          // `closed` never emits, so the page treats the drawer as open and narrows the table.
          openDrawer: () =>
            Promise.resolve(drawerStaysOpen ? { closed: NEVER, isDrawer: true } : undefined),
        },
      },
      {
        provide: FileDownloadService,
        useValue: { download: (): void => undefined },
      },
      {
        provide: ActivatedRoute,
        useValue: { params: of({ organizationId: "org-1" }), data: of({}) },
      },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: OrganizationService,
        useValue: { organizations$: () => of([{ id: "org-1", canManageAccessRules: true }]) },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Access Audit",
  component: AccessAuditComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([])),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<app-pam-access-audit />` }),
} as Meta<AccessAuditComponent>;

type Story = StoryObj<AccessAuditComponent>;

/** The populated trail. */
export const Default: Story = {
  decorators: [audit()],
  parameters: {
    chromatic: { modes: featureFlagModes(FeatureFlag.VFO1Foundation) },
  },
};

/** The populated trail on the `bit-table-v2` path. */
export const FlagOn: Story = {
  decorators: [audit()],
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
};

/** An organization with no PAM activity recorded yet. */
export const Empty: Story = {
  decorators: [audit({ events: [] })],
};

/** A failed read. A caller without AccessEventLogs sees this too, since the server answers 403. */
export const LoadError: Story = {
  decorators: [audit({ fails: true })],
};

/** The trail right after an organization's first request. */
export const SingleEvent: Story = {
  decorators: [audit({ events: [EVENTS[EVENTS.length - 2]] })],
};

/** Rotation and fleet events mixed in, each naming its own subject in the Item cell. */
export const RotationTrail: Story = {
  decorators: [audit({ events: [...ROTATION_EVENTS, ...EVENTS] })],
};

/** Long values wrap and an over-long token breaks inside its column, so the table fits the page. */
export const LongValues: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS] })],
};

/** The drawer is a stub that never closes; this story covers the columns left, not the pane. */
export const DetailsDrawerOpen: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS], drawerStaysOpen: true })],
  render: () => ({ template: `<div class="tw-max-w-3xl"><app-pam-access-audit /></div>` }),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>("#access-audit_button_details-0")!;
    await userEvent.click(row);
  },
};

/** {@link DetailsDrawerOpen} on the `bit-table-v2` path, where hidden columns leave the grid. */
export const DetailsDrawerOpenFlagOn: Story = {
  ...DetailsDrawerOpen,
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
};

/** The top row's cells open event histories; the rows below show cells that must not link. */
export const EntityLinks: Story = {
  decorators: [audit({ events: MIXED_LINK_EVENTS })],
};

/** The table and chips stay in place, with only the button showing the pending refresh. */
export const Refreshing: Story = {
  decorators: [audit({ refreshPending: true })],
  play: async ({ canvasElement }) => {
    const update = canvasElement.querySelector<HTMLButtonElement>("#access-audit_button_refresh")!;
    await fireEvent.click(update);
  },
};

/** Each missing value shows a muted dash; the automated row's System actor is a value. */
export const EmptyFields: Story = {
  decorators: [audit({ events: EMPTY_FIELD_EVENTS })],
};

/** A filter matching nothing shows the empty state, with Export disabled. */
export const NoMatches: Story = {
  decorators: [audit()],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Today");
  },
};

/** {@link NoMatches} on the `bit-table-v2` path, where the toolbar stays above the empty state. */
export const NoMatchesFlagOn: Story = {
  decorators: [audit()],
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Today");
  },
};

/** A preset in force; the Time period chip shows its selection like the other chips. */
export const TimePeriodFiltered: Story = {
  decorators: [audit({ events: liveEvents() })],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 7 days");
  },
};

/** Two chips narrowed together, which Clear all undoes in one move. */
export const FiltersActive: Story = {
  decorators: [audit({ events: liveEvents() })],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 30 days");
    await selectChipOption(canvasElement, "Event", "Request approved");
  },
};

/** {@link FiltersActive} on the `bit-table-v2` path, whose toolbar counts only loaded rows. */
export const FiltersActiveFlagOn: Story = {
  decorators: [audit({ events: liveEvents() })],
  globals: featureFlagModes(FeatureFlag.VFO1Foundation)["flag on"],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 30 days");
    await selectChipOption(canvasElement, "Event", "Request approved");
  },
};
