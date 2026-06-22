import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { AccessDecisionRequest, AccessDecisionVerdict } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { ApprovalsComponent, DecideEvent } from "./approvals.component";
import { ApproverInboxService } from "./approver-inbox.service";

/**
 * Route container for the Approvals tab. Feeds the presentational {@link ApprovalsComponent} from
 * the page-scoped {@link ApproverInboxService} (provided at the parent route so every tab shares one
 * instance) and owns the decision network call + toasts. Loading and live refresh stay with the
 * persistent shell route; this component only renders and acts.
 */
@Component({
  selector: "app-pam-approvals-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApprovalsComponent],
  template: `<app-pam-approvals
    [requests]="requests()"
    [currentUserId]="currentUserId()"
    [now]="now()"
    [loading]="loading()"
    (decide)="onDecide($event)"
  ></app-pam-approvals>`,
})
export class ApprovalsTabComponent {
  private readonly inbox = inject(ApproverInboxService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly requests = toSignal(this.inbox.requests$, { initialValue: [] });
  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: false });
  protected readonly now = toSignal(this.inbox.renderedAt$, { initialValue: new Date() });
  protected readonly currentUserId = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => a?.id ?? null)),
    { initialValue: null },
  );

  protected async onDecide(event: DecideEvent): Promise<void> {
    try {
      await this.inbox.decideAccessRequest(
        event.request.id,
        new AccessDecisionRequest({ verdict: event.verdict, comment: event.comment }),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          event.verdict === AccessDecisionVerdict.Approve
            ? "pamInboxApprovedToast"
            : "pamInboxDeniedToast",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      // The inbox service restored the row optimistically; surface the failure so the user retries.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    }
  }
}
