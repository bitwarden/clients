import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
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
import { AuditApiService } from "./audit-api.service";
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
 * Item and Detail both render unbounded free text, so the column widths only hold up under values
 * long enough to fight for room. These three are the shapes that broke the layout: a rule name well
 * past sixty characters, a full-sentence detail, and a single token longer than the column cap —
 * which has to break mid-word rather than push the table wider than the page.
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
 * The organization's members as `getAllMiniUserDetails` returns them, keyed by platform user id and
 * carrying the organization user id the entity-events dialog needs.
 *
 * Deliberately short of the identities the trail names: `user-9` acted while a member and has since been
 * removed, so that row's actor and requester stay plain text however the rest of the table links.
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
 * The linkability check. Every cell that must NOT become an anchor sits beside one that must, so a
 * regression that links everything is as visible as one that links nothing: the automated row's System
 * actor, a former member's name, an access rule (which has no entity-events dialog), and an item that
 * did not decrypt in this viewer's vault.
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
}

function audit(
  options: {
    events?: AccessAuditEventResponse[];
    fails?: boolean;
    refreshPending?: boolean;
  } = {},
) {
  const { events = EVENTS, fails = false, refreshPending = false } = options;
  return moduleMetadata({
    imports: [AccessAuditComponent],
    providers: [
      {
        provide: AuditApiService,
        // A factory rather than a value so the read counter behind `refreshPending` starts again on
        // every mount of the story, instead of once for the lifetime of the module.
        useFactory: () => {
          let reads = 0;
          return {
            listAccessAuditTrail: () => {
              reads += 1;
              if (fails) {
                return Promise.reject(new Error("audit read failed"));
              }
              return refreshPending && reads > 1
                ? new Promise<AccessAuditEventResponse[]>(() => undefined)
                : Promise.resolve(events);
            },
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
      { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
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
 * The width check. Time and Event hold on one line beside Item and Detail values long enough to
 * wrap, and the over-long token breaks inside its column — so the table stays within the page
 * instead of dragging a horizontal scrollbar onto it.
 */
export const LongValues: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS] })],
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
 * A refresh in flight. The trail is already live under every filter, so Update exists only to pull in what
 * the server has recorded since the page opened — and for as long as that read takes, the table, the chips
 * and the date range all stay exactly where the auditor left them, behind nothing but the button's own
 * pending state.
 */
export const Refreshing: Story = {
  decorators: [audit({ refreshPending: true })],
  play: async ({ canvasElement }) => {
    const update = canvasElement.querySelector<HTMLButtonElement>("#access-audit_button_refresh")!;
    await fireEvent.click(update);
  },
};

/**
 * A filter that matches nothing — Today over a trail whose newest event is older than that. Export is
 * disabled alongside the no-matches callout: the file follows the filtered table, so with nothing on screen
 * there is nothing to download. Clear all sits at the end of the chip row, which is the way back.
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
 * Two chips narrowed at once, which is where Clear all earns its place: it is the only affordance that
 * undoes them in one move. The actions sit on their own row above, so a chip label long enough to wrap
 * the row can never orphan Export onto a line of its own.
 */
export const FiltersActive: Story = {
  decorators: [audit({ events: liveEvents() })],
  play: async ({ canvasElement }) => {
    await selectChipOption(canvasElement, "Time period", "Past 30 days");
    await selectChipOption(canvasElement, "Event", "Request approved");
  },
};
