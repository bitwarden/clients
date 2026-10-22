import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  WritableSignal,
} from "@angular/core";

import {
  TabComponent,
  TabGroupComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import {
  AccessRequestDetailDialogComponent,
  AccessRequestDialogStep,
} from "./access-request-detail-dialog.component";
import {
  approvalsRequests,
  DEREK,
  historyRequests,
  myRequests as myRequestsFixture,
} from "./access-request-fixtures";
import {
  AccessApproverLike,
  AccessRequestContext,
  AccessRequestDetailView,
} from "./access-request.model";
import {
  AccessRequestsListComponent,
  RowAction,
  RowActionEvent,
} from "./access-requests-list.component";

/** Actions emitted by the detail dialog's footer (withdraw is handled via `withdrawConfirmed`). */
type DialogAction =
  "approve" | "deny" | "cancel" | "activate" | "revokeLease" | "endSession" | "resubmit";

/**
 * Snapshot of the currently open detail dialog. Mirrors `AccessRequestDetailDialogData`,
 * but held in a signal so the prototype can render the dialog inline over a backdrop
 * rather than routing through `DialogService` + CDK overlay — which doesn't lay out
 * correctly inside Storybook's harness, leaving the dialog host without its size classes.
 * The production app would wire this through `DialogService` instead.
 */
type OpenDialogState = {
  request: AccessRequestDetailView;
  context: AccessRequestContext;
  initialStep?: AccessRequestDialogStep;
};

/**
 * Full-page Access Requests prototype. Hosts the three tabs (Approvals, My
 * requests, History), owns the fixture data for each, and glues the list to
 * the detail / withdraw dialogs so clicking a row or a hover action rounds
 * through the real modal + toast components.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  imports: [
    CommonModule,
    AccessRequestsListComponent,
    AccessRequestDetailDialogComponent,
    TabGroupComponent,
    TabComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestsComponent {
  private readonly toastService = inject(ToastService);

  protected readonly approvals = signal<AccessRequestDetailView[]>(approvalsRequests);
  protected readonly myRequests = signal<AccessRequestDetailView[]>(myRequestsFixture);
  protected readonly history = signal<AccessRequestDetailView[]>(historyRequests);

  /** Which detail dialog is open, or `null` when none. */
  protected readonly openDialog = signal<OpenDialogState | null>(null);

  /** Approvals badge counts items pending my decision. */
  protected readonly approvalsCount = computed(
    () => this.approvals().filter((r) => r.status === "pending").length,
  );

  /** My requests badge counts items waiting for me to activate. */
  protected readonly myRequestsCount = computed(
    () => this.myRequests().filter((r) => r.status === "readyToUse").length,
  );

  protected onRowClick(context: AccessRequestContext, request: AccessRequestDetailView): void {
    this.openDialog.set({ request, context });
  }

  protected onAction(context: AccessRequestContext, event: RowActionEvent): void {
    // Destructive revoke on a live approval → open the detail dialog pre-advanced to the
    // withdraw step so the user still sees the item context before confirming.
    if (event.action === "revoke") {
      this.openDialog.set({ request: event.request, context, initialStep: "withdraw" });
      return;
    }
    this.applyAction(context, event.request, rowActionToDialogAction(event.action));
  }

  protected onDialogAction(action: string): void {
    const state = this.openDialog();
    if (!state) {
      return;
    }
    // The dialog's `withdraw` action is intercepted internally and surfaced via
    // `withdrawConfirmed`, so it never reaches here. Guard anyway for completeness.
    if (action === "withdraw") {
      return;
    }
    this.applyAction(state.context, state.request, action as DialogAction);
    this.openDialog.set(null);
  }

  protected onWithdrawConfirmed(payload: { reason: string }): void {
    const state = this.openDialog();
    if (!state) {
      return;
    }
    this.applyWithdraw(state.context, state.request, payload.reason);
    this.openDialog.set(null);
  }

  protected closeDialog(): void {
    this.openDialog.set(null);
  }

  /**
   * Optimistic prototype mutation: apply the action to the right tab's signal, then
   * show the toast. Each case either updates the request in place (status change) or
   * moves it to the History tab as a terminal record. Keeps hover-row actions and
   * dialog-footer actions behaving identically.
   */
  private applyAction(
    context: AccessRequestContext,
    request: AccessRequestDetailView,
    action: DialogAction,
  ): void {
    switch (action) {
      case "approve":
        this.updateIn(this.approvals, request.id, (r) => ({
          ...r,
          status: "readyToUse",
          awaitingActivation: true,
          resolvedAt: "Just now",
          decisions: [...r.decisions, decision("approve")],
        }));
        this.showToast({
          title: "Approved",
          message: `${request.requester.name} can now activate access to ${request.itemName}.`,
        });
        return;

      case "deny":
        this.moveToHistory(this.approvals, request.id, (r) => ({
          ...r,
          status: "denied",
          resolvedAt: "Just now",
          resolvedBy: DEREK,
          decisions: [...r.decisions, decision("deny")],
        }));
        this.showToast({
          title: "Denied",
          message: `${request.requester.name} has been notified.`,
        });
        return;

      case "cancel":
        this.moveToHistory(this.myRequests, request.id, (r) => ({
          ...r,
          status: "canceled",
          resolvedAt: "Just now",
          resolvedBy: r.requester,
        }));
        this.showToast({ message: `Request for ${request.itemName} canceled.` });
        return;

      case "activate":
        this.updateIn(this.myRequests, request.id, (r) => ({
          ...r,
          status: "active",
          leaseRemaining: r.leaseRemaining ?? "4h",
          awaitingActivation: false,
        }));
        this.showToast({ message: `Session started for ${request.itemName}.` });
        return;

      case "endSession":
        this.moveToHistory(this.myRequests, request.id, (r) => ({
          ...r,
          status: "sessionEnded",
          resolvedAt: "Just now",
          resolvedBy: r.requester,
          leaseRemaining: undefined,
        }));
        this.showToast({ message: `Session ended for ${request.itemName}.` });
        return;

      case "revokeLease":
        // Approver cuts a live session mid-lease → terminal "revoked" in History.
        this.moveToHistory(this.approvals, request.id, (r) => ({
          ...r,
          status: "revoked",
          resolvedAt: "Just now",
          resolvedBy: DEREK,
          leaseRemaining: undefined,
        }));
        this.showToast({
          title: "Access revoked",
          message: `Access for ${request.requester.name} has been revoked.`,
        });
        return;

      case "resubmit":
        // Prototype: no form yet, just acknowledge.
        this.showToast({ message: `Opening a new request for ${request.itemName}…` });
        return;
    }
  }

  private applyWithdraw(
    context: AccessRequestContext,
    request: AccessRequestDetailView,
    reason: string,
  ): void {
    void context;
    this.moveToHistory(this.approvals, request.id, (r) => ({
      ...r,
      status: "revoked",
      resolvedAt: "Just now",
      resolvedBy: DEREK,
      leaseRemaining: undefined,
      decisions: [
        ...r.decisions,
        {
          decider: DEREK,
          verdict: "approve",
          comment: `Withdrawn: ${reason}`,
          decidedAt: "Just now",
        },
      ],
    }));
    this.showToast({
      title: "Approval withdrawn",
      message: `Access for ${request.requester.name} has been revoked. Reason logged: "${reason}".`,
    });
  }

  /** In-place status mutation inside a single tab's signal. */
  private updateIn(
    source: WritableSignal<AccessRequestDetailView[]>,
    id: string,
    mutate: (r: AccessRequestDetailView) => AccessRequestDetailView,
  ): void {
    source.update((list) => list.map((r) => (r.id === id ? mutate(r) : r)));
  }

  /**
   * Terminal transition: remove the request from its source tab and prepend the mutated
   * version to the History tab, so the user sees it land at the top of the audit log.
   */
  private moveToHistory(
    source: WritableSignal<AccessRequestDetailView[]>,
    id: string,
    mutate: (r: AccessRequestDetailView) => AccessRequestDetailView,
  ): void {
    const original = source().find((r) => r.id === id);
    if (!original) {
      return;
    }
    source.update((list) => list.filter((r) => r.id !== id));
    this.history.update((list) => [mutate(original), ...list]);
  }

  private showToast(toast: { title?: string; message: string }): void {
    this.toastService.showToast({
      variant: "success",
      title: toast.title,
      message: toast.message,
    });
  }
}

/** Row hover-action verbs map 1:1 onto dialog actions, except `revoke` goes through the withdraw flow. */
function rowActionToDialogAction(action: Exclude<RowAction, "revoke">): DialogAction {
  return action;
}

function decision(verdict: "approve" | "deny"): {
  decider: AccessApproverLike;
  verdict: "approve" | "deny";
  decidedAt: string;
} {
  return { decider: DEREK, verdict, decidedAt: "Just now" };
}
