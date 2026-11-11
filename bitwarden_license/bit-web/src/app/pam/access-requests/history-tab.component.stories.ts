import { importProvidersFrom } from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { NEVER, of } from "rxjs";
import { userEvent, within } from "storybook/test";

import {
  AccessEventService,
  AccessRequestHistoryPage,
  AccessRequestHistoryQuery,
  AccessRequestHistoryStatus,
  AccessRequestView,
  ApprovalSdkService,
} from "@bitwarden/bit-pam";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DAY, HOUR, liveFromNow, startClockAtStoryNow } from "@bitwarden/storybook";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  accessRequest,
  decision,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { AccessNameResolverService } from "./access-name-resolver.service";
import { HistoryTabComponent } from "./history-tab.component";

const names = storyNames();

/** The chip's menu renders in a CDK overlay on `document.body`, outside the story's canvas. */
async function selectFilterOptions(
  canvasElement: HTMLElement,
  filter: string,
  options: string[],
): Promise<void> {
  await userEvent.click(
    await within(canvasElement).findByRole("button", { name: new RegExp(`^${filter}`) }),
  );
  // Scoped to the popover, since the chip also stamps each option into a hidden slot that an
  // unscoped query would match.
  const menu = await within(document.body).findByRole("dialog", { name: filter });
  for (const option of options) {
    await userEvent.click(await within(menu).findByText(option));
  }
  // The berry updates only once the menu closes.
  await userEvent.keyboard("{Escape}");
}

const derek = { human: { id: "approver-1", name: "derek.finnegan", email: "derek@example.com" } };
const sam = { requesterId: "user-2", requesterName: "sam.okafor" };

type Ended = { status: AccessRequestHistoryStatus; request: AccessRequestView };

const ended = (status: AccessRequestHistoryStatus, overrides: Record<string, unknown>): Ended => ({
  status,
  request: accessRequest({ requesterName: "marcus.chen", ...overrides }),
});

/**
 * One request per end state, newest end first, as the design frame lists them, each with the
 * status the server derives. Built in a factory, since the tab reads the real clock and the times
 * must stay relative to it.
 */
function frameRequests(): Ended[] {
  return [
    ended("denied", {
      id: "req-denied",
      cipherId: "cipher-2",
      collectionId: "col-2",
      status: "denied",
      resolvedAt: liveFromNow(0),
      decisions: [decision({ decider: derek, verdict: "deny", decidedAt: liveFromNow(0) })],
    }),
    ended("revoked", {
      id: "req-revoked",
      status: "approved",
      producedLeaseId: "lease-revoked",
      producedLeaseStatus: "revoked",
      resolvedAt: liveFromNow(-2 * HOUR),
      decisions: [
        decision({ decider: derek, decidedAt: liveFromNow(-2 * HOUR) }),
        decision({ decider: derek, verdict: "deny", decidedAt: liveFromNow(-HOUR) }),
      ],
    }),
    ended("canceled", {
      id: "req-canceled",
      cipherId: "cipher-3",
      status: "canceled",
      resolvedAt: liveFromNow(-3 * HOUR),
    }),
    ended("expired", {
      ...sam,
      id: "req-expired",
      cipherId: "cipher-2",
      collectionId: "col-2",
      status: "expired",
      leaseNotBefore: liveFromNow(-DAY - HOUR),
      leaseNotAfter: liveFromNow(-DAY),
    }),
    ended("session_ended", {
      ...sam,
      id: "req-lapsed",
      status: "approved",
      producedLeaseId: "lease-lapsed",
      producedLeaseStatus: "expired",
      producedLeaseNotAfter: liveFromNow(-2 * DAY),
      resolvedAt: liveFromNow(-2 * DAY - HOUR),
      decisions: [decision({ decider: "automatic" })],
    }),
    ended("session_ended", {
      ...sam,
      id: "req-ended",
      cipherId: "cipher-3",
      status: "approved",
      producedLeaseId: "lease-ended",
      producedLeaseStatus: "canceled",
      resolvedAt: liveFromNow(-7 * DAY - HOUR),
      decisions: [
        decision({ decider: derek, decidedAt: liveFromNow(-7 * DAY - HOUR) }),
        decision({
          decider: { human: { id: "user-2", name: "sam.okafor", email: undefined } },
          verdict: "deny",
          decidedAt: liveFromNow(-7 * DAY),
        }),
      ],
    }),
  ];
}

/** Older denials, so the history runs past one page. */
function olderRequests(count: number): Ended[] {
  return Array.from({ length: count }, (_, i) =>
    ended("denied", {
      id: `req-older-${i}`,
      status: "denied",
      resolvedAt: liveFromNow(-(8 + i) * DAY),
      decisions: [
        decision({ decider: derek, verdict: "deny", decidedAt: liveFromNow(-(8 + i) * DAY) }),
      ],
    }),
  );
}

/** Answers like the server: filters, then pages, with facets over the whole history. */
function historyServer(requests: () => Ended[]): Pick<ApprovalSdkService, "listHistory"> {
  return {
    listHistory: (query: AccessRequestHistoryQuery) => {
      const all = requests();
      const matching = all.filter(
        ({ status, request }) =>
          (query.statuses.length === 0 || query.statuses.includes(status)) &&
          (query.collectionIds.length === 0 ||
            query.collectionIds.map(uuidAsString).includes(uuidAsString(request.collectionId))) &&
          (query.requesterIds.length === 0 ||
            query.requesterIds.map(uuidAsString).includes(uuidAsString(request.requesterId))),
      );
      const start = query.page * query.pageSize;
      return Promise.resolve({
        requests: matching.slice(start, start + query.pageSize).map(({ request }) => request),
        total: matching.length,
        requesters: [
          ...new Map(
            all.map(({ request }) => [
              uuidAsString(request.requesterId),
              { id: request.requesterId, name: request.requesterName, email: undefined },
            ]),
          ).values(),
        ],
        collectionIds: [...new Set(all.map(({ request }) => uuidAsString(request.collectionId)))],
      } as unknown as AccessRequestHistoryPage);
    },
  };
}

function history(requests: () => Ended[] = frameRequests) {
  return moduleMetadata({
    imports: [HistoryTabComponent],
    providers: [
      { provide: ApprovalSdkService, useFactory: () => historyServer(requests) },
      {
        provide: AccessNameResolverService,
        useValue: { resolveNames: () => Promise.resolve(names) },
      },
      {
        provide: AccessEventService,
        useValue: { accessChanged$: () => NEVER, approverInboxChanged$: () => NEVER },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/History Tab",
  component: HistoryTabComponent,
  beforeEach: startClockAtStoryNow,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
        // The item links need a router; the wildcard and hash keep a click inside the story.
        provideRouter([{ path: "**", children: [] }], withHashLocation()),
        // `app-vault-icon` on each row reads these.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
  ],
  render: () => ({ template: `<pam-history-tab />` }),
} as Meta<HistoryTabComponent>;

type Story = StoryObj<HistoryTabComponent>;

/** Every end state, newest end first, with who or what resolved each. */
export const Default: Story = {
  decorators: [history()],
};

/** The history runs past one page; the server counts and pages it. */
export const MorePages: Story = {
  decorators: [history(() => [...frameRequests(), ...olderRequests(17)])],
};

/** Nothing has ended yet. */
export const Empty: Story = {
  decorators: [history(() => [])],
};

/** Two Status options picked, matching either. */
export const FilteredByStatus: Story = {
  decorators: [history()],
  play: async ({ canvasElement }) => {
    await selectFilterOptions(canvasElement, "Status", ["Denied", "Session ended"]);
  },
};

/** Filters across chips narrow together. */
export const FilteredAcrossFilters: Story = {
  decorators: [history()],
  play: async ({ canvasElement }) => {
    await selectFilterOptions(canvasElement, "Status", ["Session ended"]);
    await selectFilterOptions(canvasElement, "Requester", ["sam.okafor"]);
  },
};
