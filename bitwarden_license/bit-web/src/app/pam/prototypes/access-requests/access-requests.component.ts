import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";

import {
  DialogService,
  TabComponent,
  TabGroupComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { AccessRequestDetailDialogComponent } from "./access-request-detail-dialog.component";
import {
  approvalsRequests,
  historyRequests,
  myRequests as myRequestsFixture,
} from "./access-request-fixtures";
import { AccessRequestContext, AccessRequestDetailView } from "./access-request.model";
import {
  AccessRequestsListComponent,
  RowAction,
  RowActionEvent,
} from "./access-requests-list.component";

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
    TabGroupComponent,
    TabComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestsComponent {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  protected readonly approvals = signal<AccessRequestDetailView[]>(approvalsRequests);
  protected readonly myRequests = signal<AccessRequestDetailView[]>(myRequestsFixture);
  protected readonly history = signal<AccessRequestDetailView[]>(historyRequests);

  /** Approvals badge counts items pending my decision. */
  protected readonly approvalsCount = computed(
    () => this.approvals().filter((r) => r.status === "pending").length,
  );

  /** My requests badge counts items waiting for me to activate. */
  protected readonly myRequestsCount = computed(
    () => this.myRequests().filter((r) => r.status === "readyToUse").length,
  );

  protected onRowClick(context: AccessRequestContext, request: AccessRequestDetailView): void {
    this.openDetailDialog(context, request);
  }

  protected onAction(context: AccessRequestContext, event: RowActionEvent): void {
    // Destructive revoke on a live approval → open the detail dialog pre-advanced to the
    // withdraw step so the user still sees the item context before confirming.
    if (event.action === "revoke") {
      this.openDetailDialog(context, event.request, "withdraw");
      return;
    }
    this.handleQuickAction(context, event.request, event.action);
  }

  private openDetailDialog(
    context: AccessRequestContext,
    request: AccessRequestDetailView,
    initialStep?: "withdraw",
  ): void {
    const ref = AccessRequestDetailDialogComponent.open(this.dialogService, {
      request,
      context,
      initialStep,
    });
    ref.componentInstance?.withdrawConfirmed.subscribe((payload) => {
      this.toastService.showToast({
        variant: "success",
        title: "Approval withdrawn",
        message: `Access for ${request.requester.name} has been revoked. Reason logged: "${payload.reason}".`,
      });
    });
  }

  private handleQuickAction(
    context: AccessRequestContext,
    request: AccessRequestDetailView,
    action: RowAction,
  ): void {
    const toasts: Record<RowAction, { title?: string; message: string }> = {
      approve: {
        title: "Approved",
        message: `${request.requester.name} can now activate access to ${request.itemName}.`,
      },
      deny: {
        title: "Denied",
        message: `${request.requester.name} has been notified.`,
      },
      revoke: {
        title: "Access revoked",
        message: `Access for ${request.requester.name} has been revoked.`,
      },
      cancel: { message: `Request for ${request.itemName} canceled.` },
      activate: { message: "Access activated. Session ends soon." },
      endSession: { message: `Session ended for ${request.itemName}.` },
    };
    const toast = toasts[action];
    this.toastService.showToast({
      variant: "success",
      title: toast.title,
      message: toast.message,
    });
    void context;
  }
}
