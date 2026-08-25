import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ApprovalRow, toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  HOUR,
  MINUTE,
  STORY_NOW,
  accessRequest,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { ApprovalsTabComponent } from "./approvals-tab.component";

const names = storyNames();

/** `canDecide` is false only for the viewer's own request — no self-approval. */
function row(overrides: Record<string, unknown>, canDecide = true): ApprovalRow {
  return toApprovalRow(accessRequest(overrides), names, STORY_NOW, canDecide);
}

const ROWS: ApprovalRow[] = [
  row({ id: "req-1", submittedAt: new Date(STORY_NOW.getTime() - 2 * HOUR).toISOString() }),
  row({
    id: "req-2",
    cipherId: "cipher-2",
    collectionId: "col-2",
    requesterName: "Alan Turing",
    requesterEmail: "alan@example.com",
    reason: null,
    leaseNotAfter: new Date(STORY_NOW.getTime() + 4 * HOUR).toISOString(),
  }),
  row({
    id: "req-3",
    cipherId: "cipher-3",
    requesterName: "",
    requesterEmail: "katherine@example.com",
    reason: "Quarterly key rotation.",
    submittedAt: new Date(STORY_NOW.getTime() - 15 * MINUTE).toISOString(),
  }),
  // The viewer's own request: rendered, but the decide buttons are disabled rather than hidden so
  // the reason can be explained in a tooltip instead of the row looking broken.
  row({ id: "req-4", cipherId: "cipher-2", requesterName: "You", reason: "Own request." }, false),
];

function inbox(options: { rows?: ApprovalRow[]; loading?: boolean } = {}) {
  const { rows = ROWS, loading = false } = options;
  return moduleMetadata({
    imports: [ApprovalsTabComponent],
    providers: [
      {
        provide: ApproverInboxService,
        useValue: {
          loading$: of(loading),
          loadError$: of(null),
          inboxRows$: of(rows),
          cipherById$: of(names.cipherById),
          decide: () => Promise.resolve(),
        },
      },
      { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/Approvals Tab",
  component: ApprovalsTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<pam-approvals-tab />` }),
} as Meta<ApprovalsTabComponent>;

type Story = StoryObj<ApprovalsTabComponent>;

/** The populated inbox, oldest-waiting first, with the search and chip filters above it. */
export const Default: Story = {
  decorators: [inbox()],
};

/** Nothing awaiting a decision — distinct from a filter that matched nothing. */
export const Empty: Story = {
  decorators: [inbox({ rows: [] })],
};

/** The first load, before any row has arrived. */
export const Loading: Story = {
  decorators: [inbox({ rows: [], loading: true })],
};

/** A single request — the narrowest the table gets before the empty state takes over. */
export const SingleRequest: Story = {
  decorators: [inbox({ rows: [ROWS[0]] })],
};
