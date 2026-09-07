import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { NEVER, of } from "rxjs";
import { fireEvent, userEvent, within } from "storybook/test";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { DialogService } from "@bitwarden/components";
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

/**
 * The server writes each audit event self-contained, with display names snapshotted at write time,
 * so a fixture is a flat object rather than something assembled from other fixtures.
 */
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
    automated: false,
    incomplete: false,
    ...overrides,
  } as unknown as AccessAuditEventResponse;
}

/** The approver, distinct from the two requesters so the Actor and Requester chips each have something to sort. */
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

/**
 * One of each kind the trail actually emits today, newest first as the server returns them, spread
 * over a week so the date range has something to narrow.
 */
const EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-5 * MINUTE),
    leaseId: "lease-1",
    // No actor: the lease ran out on its own, which the row renders as an automated action.
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
  // No actor: the rule auto-approved it, which the row renders as an automated action.
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
  // A rule change: no cipher, so the subject column falls back to the rule name.
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

/**
 * Long text shapes that broke the layout: a rule name past sixty characters, and a single
 * token longer than the column cap, which must break mid-word.
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

/**
 * The organization's members as `getAllMiniUserDetails` returns them, keyed by platform user
 * id. Deliberately short of the trail's named identities: `user-9` is a removed member.
 */
const MEMBERS = [
  { userId: "user-1", id: "org-user-1", name: "Grace Hopper", email: "grace@example.com" },
  { userId: "user-2", id: "org-user-2", name: "Ada Lovelace", email: "ada@example.com" },
  { userId: "user-3", id: "org-user-3", name: "Katherine Johnson", email: "katherine@example.com" },
];

/** An identity the member lookup cannot resolve — a member who has since left the organization. */
const FORMER_MEMBER = {
  actorId: "user-9",
  actorName: "Alan Turing",
  actorEmail: "alan@example.com",
  requesterId: "user-9",
  requesterName: "Alan Turing",
  requesterEmail: "alan@example.com",
};

/**
 * The linkability check: cells that must not become an anchor sit beside ones that must —
 * System actor, a former member, a rule (no entity-events dialog), and an undecrypted item.
 */
const MIXED_LINK_EVENTS: AccessAuditEventResponse[] = [
  // Every cell linkable: a resolved actor, a resolved requester, and an item this vault decrypted.
  event({
    kind: AccessAuditEventKind.CredentialAccessed,
    occurredAt: fromNow(-5 * MINUTE),
    ...APPROVER,
  }),
  // Automated: the Actor cell reads System, which is not a member and never a link.
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-15 * MINUTE),
    leaseId: "lease-1",
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  // A former member: both names resolve to nothing the lookup knows, so both stay text.
  event({
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-40 * MINUTE),
    ...FORMER_MEMBER,
  }),
  // A rule change: the Item cell falls back to the rule name, which has no event history to open.
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
  // An item outside this viewer's vault: no decrypted name, so nothing to render as link text.
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

/**
 * The absence check: every cell that can carry no value carries none, except the automated
 * row's Actor cell, which reads System — that IS the value, not an absence.
 */
const EMPTY_FIELD_EVENTS: AccessAuditEventResponse[] = [
  // Nothing but a time and a kind: no actor, no requester, no item, no duration, no detail.
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
  // Automated with every other field empty: only the Actor cell reads System.
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
  // An actor but no requester: a rule change nobody asked for, and no comment recorded against it.
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
  // A full row beside them, so a regression that dashes a value is as visible as one that blanks an absence.
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
 * A trail stamped against the REAL clock, for the stories that exercise the Time period presets. The
 * presets are measured from `Date.now()`, so a {@link fromNow} fixture — anchored to a fixed past
 * instant — would fall outside every window and leave those stories showing an empty table forever.
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

/**
 * Picks an option from one of the filter chips, found by the label its trigger carries. The chip's menu
 * renders in a CDK overlay on `document.body`, outside the story's own canvas.
 */
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
  // Closes the open multi-select before the next chip, or the click lands on this menu's
  // backdrop.
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
        // A factory, not a value, so the read counter behind `refreshPending` restarts on every
        // mount.
        useFactory: () => {
          let reads = 0;
          return {
            listAccessAuditTrail: () => {
              reads += 1;
              if (fails) {
                return Promise.reject(new Error("audit read failed"));
              }
              // One page, with no position to resume from — these stories are about rendering, not paging.
              return refreshPending && reads > 1
                ? new Promise<AuditTrailPage>(() => undefined)
                : Promise.resolve({ data: events, continuationToken: null });
            },
            // The Item menu is read separately from the trail; left with nothing to offer since these
            // stories are about how the trail renders.
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
          // A ref whose `closed` never emits stays open, which is what the page reads to size the
          // table.
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

/** The populated trail, with the kind chips limited to the kinds actually present. */
export const Default: Story = {
  decorators: [audit()],
};

/** An organization with no PAM activity recorded yet. */
export const Empty: Story = {
  decorators: [audit({ events: [] })],
};

/**
 * The read failed. A caller without the AccessEventLogs permission gets a 404 rather than an empty
 * list, so this is also what insufficient permission looks like.
 */
export const LoadError: Story = {
  decorators: [audit({ fails: true })],
};

/** A single event — the trail right after an organization's first request. */
export const SingleEvent: Story = {
  decorators: [audit({ events: [EVENTS[EVENTS.length - 2]] })],
};

/**
 * The width check. Timestamp and Event hold on one line beside Item values long enough to wrap, and
 * the over-long token breaks inside its column — so the table stays within the page instead of
 * dragging a horizontal scrollbar onto it.
 */
export const LongValues: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS] })],
};

/**
 * The table with the details drawer open, standing down Actor, Requester and Duration — the
 * pane shows all three for the selected row.
 *
 * The drawer here is a ref that never closes; this story is about the column set and the fit,
 * not the pane itself.
 */
export const DetailsDrawerOpen: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS], drawerStaysOpen: true })],
  render: () => ({ template: `<div class="tw-max-w-3xl"><app-pam-access-audit /></div>` }),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>("#access-audit_button_details-0")!;
    await userEvent.click(row);
  },
};

/**
 * Which cells open an event history and which do not. The actor, requester and item of the top row are
 * all anchors; beside them sit the four that must stay plain text — the System actor, a former member's
 * name, an access rule, and an item this viewer's vault could not decrypt.
 */
export const EntityLinks: Story = {
  decorators: [audit({ events: MIXED_LINK_EVENTS })],
};

/**
 * A refresh in flight. The table, chips and date range stay exactly as the auditor left them,
 * behind nothing but the button's own pending state.
 */
export const Refreshing: Story = {
  decorators: [audit({ refreshPending: true })],
  play: async ({ canvasElement }) => {
    const update = canvasElement.querySelector<HTMLButtonElement>("#access-audit_button_refresh")!;
    await fireEvent.click(update);
  },
};

/**
 * Absence, rendered one way: Actor, Requester, Item and Duration each show a muted em dash for
 * no value, distinct from the automated row's System actor, which is a value, not an absence.
 */
export const EmptyFields: Story = {
  decorators: [audit({ events: EMPTY_FIELD_EVENTS })],
};

/**
 * A filter that matches nothing. Renders the standard empty state, not a warning callout, with
 * Export disabled and Clear all reachable from both the empty state and the chip row.
 */
export const NoMatches: Story = {
  decorators: [audit()],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Today");
  },
};

/**
 * A preset in force. The Time period chip carries its selection the way the other three carry theirs —
 * same height, same pressed styling, same dismiss — so the row reads as one family of controls, and the
 * table is narrowed to the events inside the window rather than the whole fetched trail.
 */
export const TimePeriodFiltered: Story = {
  decorators: [audit({ events: liveEvents() })],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 7 days");
  },
};

/**
 * Two chips narrowed together — where Clear all earns its place, since it undoes both in one
 * move.
 */
export const FiltersActive: Story = {
  decorators: [audit({ events: liveEvents() })],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 30 days");
    await selectChipOption(canvasElement, "Event", "Request approved");
  },
};
