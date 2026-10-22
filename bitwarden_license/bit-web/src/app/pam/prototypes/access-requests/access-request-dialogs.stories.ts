import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, I18nMockService, ToastModule, ToastService } from "@bitwarden/components";
import { enabledFlags } from "@bitwarden/storybook";

import { AccessRequestDetailDialogComponent } from "./access-request-detail-dialog.component";
import {
  amexEndingSoon,
  deniedRequest,
  expiredRequest,
  githubPending,
  salesforceActive,
  shopifyReadyToUse,
} from "./access-request-fixtures";
import { AccessRequestContext, AccessRequestDetailView } from "./access-request.model";

// Aliases used by stories that don't need to encode a specific vault item.
const baseRequest = githubPending;
const approvedRequest = shopifyReadyToUse;

/* ----------------------------- Toast host ----------------------------- */

/**
 * Minimal host component for the toast stories. Mirrors how a real page would
 * fire feedback toasts from an access-request action — the detail modal emits
 * `action`, the page translates each action into a toast + optimistic update.
 */
@Component({
  selector: "pam-toast-host",
  imports: [CommonModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-toast-container></bit-toast-container>
    <div class="tw-flex tw-flex-col tw-gap-6">
      <section>
        <h3 class="tw-mb-2 tw-text-lg tw-font-semibold">Success feedback</h3>
        <div class="tw-flex tw-flex-wrap tw-gap-2">
          <button bitButton type="button" (click)="approved()">Approved</button>
          <button bitButton type="button" (click)="denied()">Denied</button>
          <button bitButton type="button" (click)="withdrawn()">Approval withdrawn</button>
          <button bitButton type="button" (click)="canceled()">Request canceled</button>
          <button bitButton type="button" (click)="activated()">Access activated</button>
          <button bitButton type="button" (click)="sessionEnded()">Session ended</button>
        </div>
      </section>

      <section>
        <h3 class="tw-mb-2 tw-text-lg tw-font-semibold">Error feedback</h3>
        <div class="tw-flex tw-flex-wrap tw-gap-2">
          <button bitButton type="button" (click)="approveFailed()">Approve failed</button>
          <button bitButton type="button" (click)="withdrawFailed()">Withdraw failed</button>
          <button bitButton type="button" (click)="activateFailed()">
            Activate failed (expired)
          </button>
          <button bitButton type="button" (click)="networkError()">Network error</button>
        </div>
      </section>
    </div>
  `,
})
class ToastHostComponent {
  private toast = inject(ToastService);

  approved() {
    this.toast.showToast({ variant: "success", message: "Request approved" });
  }
  denied() {
    this.toast.showToast({ variant: "success", message: "Request denied" });
  }
  withdrawn() {
    this.toast.showToast({ variant: "success", message: "Approval withdrawn" });
  }
  canceled() {
    this.toast.showToast({ variant: "success", message: "Request canceled" });
  }
  activated() {
    this.toast.showToast({ variant: "success", message: "Access activated" });
  }
  sessionEnded() {
    this.toast.showToast({ variant: "success", message: "Session ended" });
  }

  approveFailed() {
    this.toast.showToast({ variant: "error", message: "Couldn’t approve request" });
  }
  withdrawFailed() {
    this.toast.showToast({ variant: "error", message: "Couldn’t withdraw approval" });
  }
  activateFailed() {
    this.toast.showToast({ variant: "warning", message: "Approval expired" });
  }
  networkError() {
    this.toast.showToast({ variant: "error", message: "Connection failed" });
  }
}

/* ----------------------------- Interactive detail host ----------------------------- */

/**
 * Interactive host that renders the detail dialog inline and shows a toast when
 * the dialog emits an action. Lets the story demonstrate the full round-trip
 * (click → feedback) without wiring the real `DialogService.open`.
 */
@Component({
  selector: "pam-detail-dialog-host",
  imports: [CommonModule, AccessRequestDetailDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-toast-container></bit-toast-container>
    <pam-access-request-detail-dialog
      [request]="request()"
      [context]="context()"
      (action)="onAction($event)"
      (withdrawConfirmed)="onWithdrawConfirmed($event)"
    ></pam-access-request-detail-dialog>
  `,
})
class DetailDialogHostComponent {
  private toast = inject(ToastService);

  readonly request = signal<AccessRequestDetailView>(baseRequest);
  readonly context = signal<AccessRequestContext>("approvals");

  onAction(action: string) {
    const messages: Record<string, { variant: "success"; message: string }> = {
      approve: { variant: "success", message: "Request approved" },
      deny: { variant: "success", message: "Request denied" },
      cancel: { variant: "success", message: "Request canceled" },
      activate: { variant: "success", message: "Access activated" },
      revokeLease: { variant: "success", message: "Session ended" },
      endSession: { variant: "success", message: "Session ended" },
      resubmit: { variant: "success", message: "New request opened" },
    };
    const toast = messages[action];
    if (toast) {
      this.toast.showToast(toast);
    }
  }

  onWithdrawConfirmed(payload: { reason: string }) {
    this.toast.showToast({
      variant: "success",
      title: "Approval withdrawn",
      message: `Reason logged: "${payload.reason}".`,
    });
  }
}

/* ----------------------------- Story meta ----------------------------- */

const i18nMock = () =>
  new I18nMockService({
    loading: "Loading",
    close: "Close",
    back: "Back",
    more: "More",
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
    progressBar: "Progress bar",
    required: "required",
    inputRequired: "Input is required.",
  });

/**
 * Build the Markdown description that renders at the top of each story's Docs
 * tab. Lives alongside the stories so designers can edit a user story without
 * leaving the file.
 */
const userStory = (parts: {
  userStory: string;
  jobToBeDone: string;
  acceptanceCriteria: string[];
}): string => `
### User story
${parts.userStory}

### Job to be done
${parts.jobToBeDone}

### Acceptance criteria
${parts.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
`;

const COMPONENT_DESCRIPTION = `
A single dialog shell used for every access-request state across three contexts:

- **Approvals** — approver's point of view, deciding on or managing a request they own.
- **My requests** — requester's point of view, tracking or acting on their own request.
- **History** — read-only audit view, available to anyone who can see the record.

Each story below captures the user story, job to be done, and acceptance
criteria for one state × context so we can confirm the dialog is doing the
right thing for the person looking at it.
`;

export default {
  title: "Prototypes/PAM/Access Request Dialogs",
  parameters: {
    docs: {
      description: {
        component: COMPONENT_DESCRIPTION,
      },
    },
  },
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        BrowserAnimationsModule,
        AccessRequestDetailDialogComponent,
        ButtonModule,
        ToastHostComponent,
        DetailDialogHostComponent,
      ],
    }),
    applicationConfig({
      providers: [
        ToastModule.forRoot().providers!,
        { provide: I18nService, useFactory: i18nMock },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: { showFavicons$: of(true) },
        },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => of(false) },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj;

/* ============================================================
 * Approvals (approver's POV)
 * ============================================================ */

export const ApprovalsPending: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to review a pending request with full context — who is asking, what they want, why, and for how long — so that I can confidently approve or deny.",
          jobToBeDone: "Decide whether to grant a teammate access to a specific vault item.",
          acceptanceCriteria: [
            "Requester identity, requested item, justification, and requested access window are all visible without scrolling past them.",
            "Approve and Deny are both reachable from the footer.",
            "Deny is visually separated from Approve so it cannot be mis-clicked.",
            'Status badge reads "Pending approval".',
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: baseRequest, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const ApprovalsApproved: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to re-open a request I already approved so that I can confirm the terms, or withdraw the approval if circumstances changed before the requester uses it.",
          jobToBeDone: "Audit an approval I made and reverse it if it should no longer stand.",
          acceptanceCriteria: [
            "Decision summary (who approved, when, for how long) is visible.",
            "Withdraw approval action is available as the primary footer action.",
            "No approve/deny controls — the decision has already been made.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: approvedRequest, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const ApprovalsDenied: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want a read-only view of a denial I made so that I can reference it later for compliance or follow-up without any risk of changing the decision.",
          jobToBeDone: "Recall what I denied and why — treat the record as closed.",
          acceptanceCriteria: [
            "No actions available in the footer (Close only).",
            "Denial reason is visible if one was captured.",
            'Status badge reads "Denied".',
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: deniedRequest, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const ApprovalsExpired: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want expired requests to read as clearly closed so that I don't try to act on a stale request after the approval window has passed.",
          jobToBeDone:
            "Understand why a request didn't go through and recognize that the decision window is over.",
          acceptanceCriteria: [
            "No actions available in the footer (Close only).",
            'Status badge reads "Expired" using the danger variant to match the "blocked" outcome.',
            "Shows when the request expired.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: expiredRequest, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** Approved by me, requester has not yet opened the item (list badge: "Ready to use"). */
export const ApprovalsReadyToUse: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to withdraw an approval before the requester activates it so that I can reverse the decision cleanly without disrupting a live session.",
          jobToBeDone: "Pull back an approval while the window is still unused.",
          acceptanceCriteria: [
            "Withdraw approval is the primary action.",
            'Status badge reads "Ready to use".',
            "Dialog surfaces who has access and the active window.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: shopifyReadyToUse, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** Approved by me, lease is active and healthy (list badge: "{time} left"). */
export const ApprovalsActive: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to end a session that's currently in progress so that I can revoke access the moment I decide it should stop.",
          jobToBeDone: "Cut a live session short because something changed since I approved.",
          acceptanceCriteria: [
            "End session is the primary action and uses the destructive style.",
            'Status badge shows the remaining lease time (e.g. "42m left").',
            "Session details (requester, started at, ends at) are visible.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: salesforceActive, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** Approved by me, lease is close to the end (list badge: "Ending soon • 4m left"). */
export const ApprovalsEndingSoon: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to see when a session is minutes from ending so that I can decide whether to let it finish on its own or cut it immediately.",
          jobToBeDone: "Monitor a session that's about to end and intervene if needed.",
          acceptanceCriteria: [
            'Status badge reads "Ending soon · {N}m left" using the danger variant.',
            "End session action remains available for immediate cutoff.",
            "Remaining time is prominent enough that it drives the decision.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: amexEndingSoon, context: "approvals" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/* ============================================================
 * My requests (requester's POV)
 * ============================================================ */

export const MyRequestsPending: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to check on my pending request and cancel it if I no longer need access so that approvers don't waste time on stale asks.",
          jobToBeDone: "Monitor the status of my own request and withdraw it if plans changed.",
          acceptanceCriteria: [
            "Shows that the request is waiting on an approver.",
            "Cancel request action is the primary footer action.",
            "Shows who the approver(s) are so I can follow up out-of-band if needed.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: baseRequest, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const MyRequestsApproved: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to start my session when I'm ready to work so that my access window doesn't start burning down until I actually need it.",
          jobToBeDone: "Start the session I was approved for, on my timing.",
          acceptanceCriteria: [
            "Start session is the primary action.",
            "Approved time window and who approved are visible.",
            "No countdown has started yet — the clock begins at activation.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: approvedRequest, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const MyRequestsDenied: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to see why my request was denied and resubmit if I still need access so that I can address the approver's concern instead of guessing.",
          jobToBeDone: "Understand the denial and decide whether to try again.",
          acceptanceCriteria: [
            "Denial reason is visible if the approver provided one.",
            "Submit new request action is the primary footer action.",
            'Status badge reads "Denied".',
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: deniedRequest, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const MyRequestsExpired: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to resubmit when my request expired so that I don't have to re-enter everything from scratch when nobody acted in time.",
          jobToBeDone: "Restart the request flow after the decision window closed.",
          acceptanceCriteria: [
            'Status badge reads "Expired".',
            "Submit new request action is available.",
            "Prior request context (item, justification, duration) stays visible for reference.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: expiredRequest, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** My request was approved, I haven't opened the item yet. */
export const MyRequestsReadyToUse: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to start my approved session when I'm ready so that the lease clock only starts when I actually begin work.",
          jobToBeDone: "Activate my session on my own timing.",
          acceptanceCriteria: [
            "Start session is the primary action.",
            "Shows the total approved duration (not a countdown yet).",
            'Status badge reads "Ready to use".',
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: shopifyReadyToUse, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** My session is active. End-my-session is destructive-slot primary. */
export const MyRequestsActive: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want to end my own session when I'm done so that I release access cleanly instead of leaving a window open longer than I need.",
          jobToBeDone: "Close out my session early and release access.",
          acceptanceCriteria: [
            "End access is the primary action and uses the destructive style.",
            "Remaining time on the lease is clearly displayed.",
            "Session details confirm what I'm about to end.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: salesforceActive, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/** My session has minutes left — nudges me to resubmit if I need more time. */
export const MyRequestsEndingSoon: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As a requester, I want a clear nudge when my session is almost over so that I can wrap up or kick off a new request to extend my access without losing continuity.",
          jobToBeDone: "Know how much time is left and decide whether to extend.",
          acceptanceCriteria: [
            'Status badge reads "Ending soon · {N}m left" using the danger variant.',
            "End access remains available for a clean shutdown.",
            "Remaining time is prominent enough to drive the decision.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: amexEndingSoon, context: "my-requests" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/* ============================================================
 * History (read-only, no actions)
 * ============================================================ */

export const HistoryApproved: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As anyone reviewing history, I want a read-only view of a past approval so that I can audit what happened without any risk of changing the record.",
          jobToBeDone: "Reference a historical approval during an audit or follow-up.",
          acceptanceCriteria: [
            "No action buttons in the footer (Close only).",
            "Full decision context (requester, approver, item, window, outcome) is visible.",
            "Status badge reflects the terminal state of the request.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: approvedRequest, context: "history" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

export const HistoryDenied: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As anyone reviewing history, I want a read-only view of a past denial so that I can audit the decision without any risk of changing the record.",
          jobToBeDone: "Reference a historical denial during an audit or follow-up.",
          acceptanceCriteria: [
            "No action buttons in the footer (Close only).",
            "Denial reason is visible if one was captured.",
            'Status badge reads "Denied".',
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: deniedRequest, context: "history" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/* ============================================================
 * Withdraw Approval Confirmation
 * ============================================================
 * Withdraw lives inside the same detail dialog — step="withdraw" swaps the body
 * to the destructive ask + reason input and swaps the title to match. The back
 * arrow in the dialog header returns to the detail view.
 */

export const WithdrawApprovalConfirm: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  parameters: {
    docs: {
      description: {
        story: userStory({
          userStory:
            "As an approver, I want to provide a reason when I withdraw an approval so that the requester understands why the decision changed and I'm forced to be deliberate about a destructive action.",
          jobToBeDone: "Confirm a withdrawal with a short note that the requester will see.",
          acceptanceCriteria: [
            "Reason field is required — Withdraw approval stays disabled until a reason is entered.",
            'Primary action is labeled "Withdraw approval" and uses the destructive style.',
            "Back arrow in the header returns to the detail view without discarding the typed reason.",
            "Cancel is available as a secondary action.",
            "Identity card (who, what) stays visible so the destructive action always has context.",
          ],
        }),
      },
    },
  },
  render: () => ({
    props: { request: shopifyReadyToUse, context: "approvals", initialStep: "withdraw" },
    template: /* HTML */ `
      <pam-access-request-detail-dialog
        [request]="request"
        [context]="context"
        [initialStep]="initialStep"
      ></pam-access-request-detail-dialog>
    `,
  }),
};

/* ============================================================
 * Interactive — fires toasts in response to actions
 * ============================================================ */

export const InteractiveWithToasts: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    template: /* HTML */ `<pam-detail-dialog-host></pam-detail-dialog-host>`,
  }),
};

/* ============================================================
 * Feedback & Error toasts (standalone catalogue)
 * ============================================================ */

export const FeedbackToasts: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    template: /* HTML */ `<pam-toast-host></pam-toast-host>`,
  }),
};
