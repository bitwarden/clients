import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
  viewChildren,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IconModule, NoItemsModule, ToastService, TypographyModule } from "@bitwarden/components";
import {
  InboxLeaseRequestResponse,
  LeaseDecision,
  LeaseDecisionRequest,
  canApprove,
} from "@bitwarden/pam";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxRowComponent } from "./approver-inbox-row.component";
import { ApproverInboxService } from "./approver-inbox.service";

/**
 * Approver inbox page. Lists pending lease requests for collections the
 * caller can Manage and lets them approve or deny with an optional comment.
 *
 * The frontend never decides who an approver is — the server-side inbox
 * endpoint filters by Manage permission. The page only enforces the
 * self-approval guard, which is an additional UX safeguard.
 */
 
@Component({
  selector: "pam-approver-inbox",
  templateUrl: "./approver-inbox.component.html",
  providers: [ApproverInboxService],
  imports: [
    CommonModule,
    JslibModule,
    ApproverInboxRowComponent,
    IconModule,
    NoItemsModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproverInboxComponent implements OnInit {
  private readonly inbox = inject(ApproverInboxService);
  private readonly badgeService = inject(ApproverInboxBadgeService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly rows = viewChildren(ApproverInboxRowComponent);

  /**
   * Server filters by Manage. The two empty states differ in copy:
   * - true (default): "No requests waiting."
   * - false: "You're not designated to approve requests for any collections."
   *
   * Exposed as an input so storybook / parents can drive the alternate
   * empty-state copy. Production callers will leave this at the default and
   * an upcoming ticket will resolve it from collection metadata.
   */
  readonly hasManagerCollections = input<boolean>(true);

  protected readonly currentUserId = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => a?.id ?? null)),
    { initialValue: null },
  );

  protected readonly requests = toSignal(this.inbox.requests$, { initialValue: [] });
  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: false });

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    try {
      await this.inbox.load();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxLoadFailed"),
      });
    }
  }

  protected canDecide(request: InboxLeaseRequestResponse): boolean {
    const userId = this.currentUserId();
    if (userId == null) {
      return false;
    }
    return canApprove({ requesterUserId: request.requesterUserId }, { id: userId });
  }

  protected async onDecide(
    request: InboxLeaseRequestResponse,
    event: { decision: LeaseDecision; comment: string | undefined },
  ): Promise<void> {
    try {
      await this.inbox.submitDecision(
        request.id,
        new LeaseDecisionRequest({ decision: event.decision, comment: event.comment }),
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(
          event.decision === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
        ),
      });
      // Best-effort badge refresh; failure here is swallowed by the service.
      void this.badgeService.refresh();
    } catch (e) {
      this.logService.error(e);
      const row = this.rows().find((r) => r.request().id === request.id);
      row?.resetAfterFailure();
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    }
  }

  /** Used by *trackBy on the inbox list. */
  protected trackById(_index: number, request: InboxLeaseRequestResponse): string {
    return request.id;
  }

  /**
   * Snapshot the current "now" for elapsed-time rendering. Computed once
   * per load so all rows agree on the reference clock.
   */
  protected readonly renderedAt = signal<Date>(new Date());
}
